#!/usr/bin/env node

import { confirm, input, select } from "@inquirer/prompts";
import { Command } from "commander";
import { initializeProject } from "./commands/init.js";
import { runIssueCommand } from "./commands/issue.js";
import type { AgentName } from "./lib/config.js";

const program = new Command();

program
  .name("coding-factory")
  .description("Orchestrate coding agents against GitHub issues.")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize coding-factory in the current repository.")
  .action(async () => {
    await initializeProject({
      cwd: process.cwd(),
      prompts: {
        chooseAgent: async () =>
          select<AgentName>({
            message: "Choose the default agent",
            choices: [
              { name: "Codex", value: "codex" },
              { name: "Claude", value: "claude" }
            ]
          }),
        enterTestCommand: async () =>
          input({
            message: "Enter the command used to run tests in this repository"
          }),
        confirmOverwrite: async (configDirectory) =>
          confirm({
            message: `${configDirectory} already exists. Overwrite managed files?`,
            default: false
          })
      },
      stdout: process.stdout
    });
  });

program
  .command("issue")
  .description("Start work on a GitHub issue.")
  .argument("<number>", "GitHub issue number")
  .action(async (issueNumber: string) => {
    await runIssueCommand({
      cwd: process.cwd(),
      issueNumber,
      stdout: process.stdout
    });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
