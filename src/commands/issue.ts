import type { Writable } from "node:stream";
import { IssueOrchestrator } from "../lib/issue-orchestrator.js";

export interface IssueCommandDependencies {
  getCwd?: () => string;
  issueOrchestrator?: Pick<IssueOrchestrator, "run">;
  stdout?: Pick<Writable, "write">;
}

export class IssueCommand {
  constructor(private readonly dependencies: IssueCommandDependencies = {}) {}

  async run(issueNumber: string): Promise<void> {
    const cwd = (this.dependencies.getCwd ?? process.cwd)();
    const issueOrchestrator =
      this.dependencies.issueOrchestrator ?? new IssueOrchestrator();
    const stdout = this.dependencies.stdout ?? process.stdout;
    const result = await issueOrchestrator.run({ cwd, issueNumber });

    stdout.write(
      `Issue orchestration for #${result.issueNumber} is not implemented yet. ` +
        `Current default agent: ${result.config.defaultAgent}.\n`
    );
  }
}
