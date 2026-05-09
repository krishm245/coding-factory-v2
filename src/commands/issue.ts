import { IssueOrchestrator } from "../lib/issue-orchestrator.js";

export interface IssueCommandDependencies {
  getCwd?: () => string;
  issueOrchestrator?: Pick<IssueOrchestrator, "run">;
}

export class IssueCommand {
  constructor(private readonly dependencies: IssueCommandDependencies = {}) {}

  async run(issueNumber: string): Promise<void> {
    const cwd = (this.dependencies.getCwd ?? process.cwd)();
    const issueOrchestrator = this.dependencies.issueOrchestrator;

    if (!issueOrchestrator) {
      throw new Error("Issue command is missing its orchestrator dependency.");
    }

    await issueOrchestrator.run({ cwd, issueNumber });
  }
}
