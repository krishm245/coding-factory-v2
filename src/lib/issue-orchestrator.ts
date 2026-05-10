import {
  CodingFactoryConfigStore,
  type CodingFactoryConfig,
} from "./config.js";
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

    return {
      ...preparedRequest,
      branchName,
      config,
    };
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
}
