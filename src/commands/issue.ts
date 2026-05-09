import { IssueOrchestrator } from "../lib/issue-orchestrator.js";

export interface IssueCommandDependencies {
  getCwd: () => string;
  issueOrchestrator: Pick<IssueOrchestrator, "run">;
}

export class IssueCommand {
  constructor(private readonly dependencies: IssueCommandDependencies) {}

  async run(issueNumber: string): Promise<void> {
    const cwd = this.dependencies.getCwd();
    await this.dependencies.issueOrchestrator.run({ cwd, issueNumber });
  }
}
