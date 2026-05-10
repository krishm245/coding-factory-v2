import type { CodingFactoryConfig } from "./config.js";
import type { DockerWorkerHandle } from "./docker-worker-service.js";

export interface IssueWorkflowContext {
  branchName: string;
  config: CodingFactoryConfig;
  cwd: string;
  issueNumber: number;
  worker: DockerWorkerHandle;
}

export class IssueWorkflowRunner {
  async run(_context: IssueWorkflowContext): Promise<void> {}
}
