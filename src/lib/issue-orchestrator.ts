import {
  CodingFactoryConfigStore,
  type CodingFactoryConfig,
} from "./config.js";

export interface IssueOrchestrationRequest {
  cwd: string;
  issueNumber: string;
}

export interface IssueOrchestrationContext {
  cwd: string;
  config: CodingFactoryConfig;
  issueNumber: number;
}

export interface IssueOrchestratorDependencies {
  configStore: Pick<CodingFactoryConfigStore, "load">;
}

export class IssueOrchestrator {
  private issueOrchestratorContext: IssueOrchestrationContext | null = null;
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

    this.createIssueOrchestrationContextWithConfig(preparedRequest, config);

    if (!this.issueOrchestratorContext) {
      throw new Error("Issue orchestrator context is not initialized.");
    }

    return this.issueOrchestratorContext;
  }

  private prepare(
    request: IssueOrchestrationRequest,
  ): Omit<IssueOrchestrationContext, "config"> {
    const issueNumber = Number.parseInt(request.issueNumber, 10);

    if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
      throw new Error("Issue number must be a positive integer.");
    }

    return {
      cwd: request.cwd,
      issueNumber,
    };
  }

  private createIssueOrchestrationContextWithConfig(
    preparedRequest: Omit<IssueOrchestrationContext, "config">,
    config: CodingFactoryConfig,
  ) {
    this.issueOrchestratorContext = {
      ...preparedRequest,
      config,
    };
  }
}
