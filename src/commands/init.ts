import { confirm, input, select } from "@inquirer/prompts";
import type { Writable } from "node:stream";
import { type AgentName } from "../lib/agent-runtime.js";
import { ProjectInitializer } from "../lib/project-initializer.js";

export interface InitPrompts {
  chooseAgent(): Promise<AgentName>;
  enterTestCommand(): Promise<string>;
  confirmOverwrite(configDirectory: string): Promise<boolean>;
}

export interface InitCommandDependencies {
  getCwd: () => string;
  projectInitializer: Pick<ProjectInitializer, "initialize" | "inspect">;
  prompts: InitPrompts;
  stdout: Pick<Writable, "write">;
}

export class InitCommand {
  constructor(private readonly dependencies: InitCommandDependencies) {}

  async run(): Promise<void> {
    const cwd = this.dependencies.getCwd();
    const projectInitializer = this.dependencies.projectInitializer;
    const prompts = this.dependencies.prompts;
    const stdout = this.dependencies.stdout;
    const inspection = await projectInitializer.inspect(cwd);

    if (inspection.exists) {
      const shouldOverwrite = await prompts.confirmOverwrite(
        inspection.paths.configDirectory
      );

      if (!shouldOverwrite) {
        stdout.write("Initialization cancelled.\n");
        return;
      }
    }

    const defaultAgent = await prompts.chooseAgent();
    const testCommand = await prompts.enterTestCommand();
    const result = await projectInitializer.initialize({
      cwd,
      defaultAgent,
      testCommand
    });

    stdout.write(`Created ${result.paths.configDirectory}\n`);
    stdout.write(
      `Update ${result.paths.envPath} with your secrets before running issue orchestration.\n`
    );
  }
}

const defaultPrompts: InitPrompts = {
  chooseAgent: () =>
    select<AgentName>({
      message: "Choose the default agent",
      choices: [
        { name: "Codex", value: "codex" },
        { name: "Claude", value: "claude" }
      ]
    }),
  confirmOverwrite: (configDirectory: string) =>
    confirm({
      message: `${configDirectory} already exists. Overwrite managed files?`,
      default: false
    }),
  enterTestCommand: () =>
    input({
      message: "Enter the command used to run tests in this repository"
    })
};

export function createDefaultInitPrompts(): InitPrompts {
  return defaultPrompts;
}
