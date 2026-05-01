#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { confirm, input, select } from "@inquirer/prompts";
import { Command } from "commander";
import type { Command as CommandInstance } from "commander";
import {
  initializeProject,
  type InitFileSystem,
  type InitPrompts
} from "./commands/init.js";
import { runIssueCommand, type ReadConfig } from "./commands/issue.js";
import type { AgentName } from "./lib/config.js";

export interface CliDependencies {
  chooseAgent?: InitPrompts["chooseAgent"];
  confirmOverwrite?: InitPrompts["confirmOverwrite"];
  enterTestCommand?: InitPrompts["enterTestCommand"];
  getCwd?: () => string;
  initFileSystem?: InitFileSystem;
  readConfig?: ReadConfig;
  stderr?: Pick<NodeJS.WritableStream, "write">;
  stdout?: Pick<NodeJS.WritableStream, "write">;
}

export function createProgram(dependencies: CliDependencies = {}): Command {
  const program = new Command();

  program
    .name("coding-factory")
    .description("Orchestrate coding agents against GitHub issues.")
    .version("0.1.0");

  registerInitCommand(program, dependencies);
  registerIssueCommand(program, dependencies);

  return program;
}

export function registerInitCommand(
  program: CommandInstance,
  dependencies: CliDependencies = {}
): CommandInstance {
  program
    .command("init")
    .description("Initialize coding-factory in the current repository.")
    .action(async () => {
      const chooseAgent = dependencies.chooseAgent ?? defaultChooseAgent;
      const confirmOverwrite = dependencies.confirmOverwrite ?? defaultConfirmOverwrite;
      const enterTestCommand = dependencies.enterTestCommand ?? defaultEnterTestCommand;
      const getCwd = dependencies.getCwd ?? process.cwd;
      const stdout = dependencies.stdout ?? process.stdout;

      const initOptions = {
        cwd: getCwd(),
        prompts: {
          chooseAgent,
          confirmOverwrite,
          enterTestCommand
        },
        stdout
      };

      await initializeProject(
        dependencies.initFileSystem
          ? { ...initOptions, fileSystem: dependencies.initFileSystem }
          : initOptions
      );
    });

  return program;
}

export function registerIssueCommand(
  program: CommandInstance,
  dependencies: CliDependencies = {}
): CommandInstance {
  program
    .command("issue")
    .description("Start work on a GitHub issue.")
    .argument("<number>", "GitHub issue number")
    .action(async (issueNumber: string) => {
      const getCwd = dependencies.getCwd ?? process.cwd;
      const stdout = dependencies.stdout ?? process.stdout;

      const issueOptions = {
        cwd: getCwd(),
        issueNumber,
        stdout
      };

      await runIssueCommand(
        dependencies.readConfig
          ? { ...issueOptions, readConfig: dependencies.readConfig }
          : issueOptions
      );
    });

  return program;
}

export async function runCli(argv: string[], dependencies: CliDependencies = {}): Promise<void> {
  await createProgram(dependencies).parseAsync(argv);
}

function defaultChooseAgent(): Promise<AgentName> {
  return select<AgentName>({
    message: "Choose the default agent",
    choices: [
      { name: "Codex", value: "codex" },
      { name: "Claude", value: "claude" }
    ]
  });
}

function defaultEnterTestCommand(): Promise<string> {
  return input({
    message: "Enter the command used to run tests in this repository"
  });
}

function defaultConfirmOverwrite(configDirectory: string): Promise<boolean> {
  return confirm({
    message: `${configDirectory} already exists. Overwrite managed files?`,
    default: false
  });
}

function handleCliError(error: unknown, stderr: Pick<NodeJS.WritableStream, "write">): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function isExecutedDirectly(): boolean {
  return process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isExecutedDirectly()) {
  runCli(process.argv).catch((error: unknown) => {
    handleCliError(error, process.stderr);
  });
}
