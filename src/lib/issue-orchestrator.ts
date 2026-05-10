import {
  CodingFactoryConfigStore,
  type CodingFactoryConfig,
} from "./config.js";
import { DockerWorkerService } from "./docker-worker-service.js";
import { IssueWorkflowRunner } from "./issue-workflow-runner.js";
import { RepoPreparationService } from "./repo-preparation-service.js";

export interface IssueOrchestrationRequest {
  cwd: string;
  issueNumber: string;
}

export interface IssueOrchestrationContext {
  branchName: string;
  cwd: string;
  config: CodingFactoryConfig;
  issueNumber: number;
}

export interface IssueOrchestratorDependencies {
  configStore: Pick<CodingFactoryConfigStore, "load">;
  dockerWorkerService: Pick<
    DockerWorkerService,
    "cleanupWorker" | "startWorker"
  >;
  issueWorkflowRunner: Pick<IssueWorkflowRunner, "run">;
  repoPreparationService: Pick<RepoPreparationService, "prepareIssueBranch">;
}

interface PreparedIssueOrchestrationRequest {
  cwd: string;
  issueNumber: number;
}

export class IssueOrchestrator {
  constructor(private readonly dependencies: IssueOrchestratorDependencies) {}

  async run(
    request: IssueOrchestrationRequest,
  ): Promise<IssueOrchestrationContext> {
    const preparedRequest = this.prepare(request);

    const config = await this.dependencies.configStore.load(
      preparedRequest.cwd,
    );

    if (!config) {
      throw new Error(
        "Project is not initialized. Run `coding-factory init` first.",
      );
    }

    const branchName = this.buildBranchName(
      config.branchPrefix,
      preparedRequest.issueNumber,
    );

    await this.dependencies.repoPreparationService.prepareIssueBranch({
      cwd: preparedRequest.cwd,
      branchName,
    });

    const context = {
      ...preparedRequest,
      branchName,
      config,
    };

    const worker = await this.dependencies.dockerWorkerService.startWorker({
      cwd: preparedRequest.cwd,
      dockerfilePath: config.dockerfilePath,
      imageName: config.imageName,
      issueNumber: preparedRequest.issueNumber,
    });

    try {
      await this.dependencies.issueWorkflowRunner.run({
        ...context,
        worker,
      });
    } catch (error) {
      await this.cleanupWorker(worker, error);
      throw error;
    }

    await this.cleanupWorker(worker);

    return context;
  }

  private prepare(
    request: IssueOrchestrationRequest,
  ): PreparedIssueOrchestrationRequest {
    const issueNumber = Number.parseInt(request.issueNumber, 10);

    if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
      throw new Error("Issue number must be a positive integer.");
    }

    return {
      cwd: request.cwd,
      issueNumber,
    };
  }

  private buildBranchName(branchPrefix: string, issueNumber: number): string {
    return `${branchPrefix}/issue-${issueNumber}`;
  }

  private async cleanupWorker(
    worker: Awaited<
      ReturnType<
        IssueOrchestratorDependencies["dockerWorkerService"]["startWorker"]
      >
    >,
    error?: unknown,
  ): Promise<void> {
    try {
      await this.dependencies.dockerWorkerService.cleanupWorker(worker);
    } catch (cleanupError) {
      if (error === undefined) {
        throw cleanupError;
      }

      throw this.createWorkflowCleanupError(error, cleanupError);
    }
  }

  private createWorkflowCleanupError(
    error: unknown,
    cleanupError: unknown,
  ): Error {
    const workflowError = ensureError(error);
    const dockerCleanupError = ensureError(cleanupError);

    return new Error(
      `${workflowError.message} Cleanup also failed: ${dockerCleanupError.message}`,
    );
  }
}

function ensureError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
