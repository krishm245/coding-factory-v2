#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { Command } from "commander";
import type { Command as CommandInstance } from "commander";
import { InitCommand } from "./commands/init.js";
import { IssueCommand } from "./commands/issue.js";
import { CodingFactoryConfigStore } from "./lib/config.js";
import { IssueOrchestrator } from "./lib/issue-orchestrator.js";

export interface CliDependencies {
  initCommand?: Pick<InitCommand, "run">;
  issueCommand?: Pick<IssueCommand, "run">;
  stderr?: Pick<NodeJS.WritableStream, "write">;
}

export function createProgram(dependencies: CliDependencies = {}): Command {
  const program = new Command();
  const initCommand = dependencies.initCommand ?? new InitCommand();
  const issueCommand =
    dependencies.issueCommand ??
    new IssueCommand({
      issueOrchestrator: new IssueOrchestrator({
        configStore: new CodingFactoryConfigStore(),
      }),
    });

  program
    .name("coding-factory")
    .description("Orchestrate coding agents against GitHub issues.")
    .version("0.1.0");

  registerInitCommand(program, initCommand);
  registerIssueCommand(program, issueCommand);

  return program;
}

export function registerInitCommand(
  program: CommandInstance,
  initCommand: Pick<InitCommand, "run">,
): CommandInstance {
  program
    .command("init")
    .description("Initialize coding-factory in the current repository.")
    .action(async () => initCommand.run());

  return program;
}

export function registerIssueCommand(
  program: CommandInstance,
  issueCommand: Pick<IssueCommand, "run">,
): CommandInstance {
  program
    .command("issue")
    .description("Start work on a GitHub issue.")
    .argument("<number>", "GitHub issue number")
    .action(async (issueNumber: string) => issueCommand.run(issueNumber));

  return program;
}

export async function runCli(
  argv: string[],
  dependencies: CliDependencies = {},
): Promise<void> {
  await createProgram(dependencies).parseAsync(argv);
}

function handleCliError(
  error: unknown,
  stderr: Pick<NodeJS.WritableStream, "write">,
): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function isExecutedDirectly(): boolean {
  return (
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === process.argv[1]
  );
}

if (isExecutedDirectly()) {
  runCli(process.argv).catch((error: unknown) => {
    handleCliError(error, process.stderr);
  });
}
