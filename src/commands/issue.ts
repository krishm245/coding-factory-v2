import type { Writable } from "node:stream";
import { readConfig } from "../lib/config.js";

export interface RunIssueCommandOptions {
  cwd: string;
  issueNumber: string;
  stdout: Pick<Writable, "write">;
}

export async function runIssueCommand(options: RunIssueCommandOptions): Promise<void> {
  const { cwd, issueNumber, stdout } = options;
  const parsedIssueNumber = Number.parseInt(issueNumber, 10);

  if (!Number.isInteger(parsedIssueNumber) || parsedIssueNumber <= 0) {
    throw new Error("Issue number must be a positive integer.");
  }

  const config = await readConfig(cwd);

  if (!config) {
    throw new Error("Project is not initialized. Run `coding-factory init` first.");
  }

  stdout.write(
    `Issue orchestration for #${parsedIssueNumber} is not implemented yet. ` +
      `Current default agent: ${config.defaultAgent}.\n`
  );
}
