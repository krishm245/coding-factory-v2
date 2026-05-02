import {
  CodingFactoryConfigStore,
  type CodingFactoryConfig
} from "./config.js";

export interface IssueOrchestrationRequest {
  cwd: string;
  issueNumber: string;
}

export interface IssueOrchestrationResult {
  config: CodingFactoryConfig;
  issueNumber: number;
}

export class IssueOrchestrator {
  constructor(
    private readonly configStore: Pick<CodingFactoryConfigStore, "load"> = new CodingFactoryConfigStore()
  ) {}

  async run(
    request: IssueOrchestrationRequest
  ): Promise<IssueOrchestrationResult> {
    const issueNumber = Number.parseInt(request.issueNumber, 10);

    if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
      throw new Error("Issue number must be a positive integer.");
    }

    const config = await this.configStore.load(request.cwd);

    if (!config) {
      throw new Error("Project is not initialized. Run `coding-factory init` first.");
    }

    return {
      config,
      issueNumber
    };
  }
}
