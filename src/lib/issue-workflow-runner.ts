import type { CodingFactoryConfig } from "./config.js";
import type { DockerWorkerHandle } from "./docker-worker-service.js";
import { GitHubIssueService } from "./github-issue-service.js";

export interface IssueWorkflowContext {
  branchName: string;
  config: CodingFactoryConfig;
  cwd: string;
  issueNumber: number;
  worker: DockerWorkerHandle;
}

export interface IssueWorkflowRunnerDependencies {
  gitHubIssueService: Pick<GitHubIssueService, "fetchIssue">;
}

export class IssueWorkflowRunner {
  constructor(private readonly dependencies: IssueWorkflowRunnerDependencies) {}

  async run(context: IssueWorkflowContext): Promise<void> {
    await this.dependencies.gitHubIssueService.fetchIssue({
      issueNumber: context.issueNumber,
      worker: context.worker,
    });
  }
}
