import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import type { Writable } from "node:stream";
import { buildConfig, getCodingFactoryPaths, serializeConfig, type AgentName } from "../lib/config.js";
import { buildDockerfile } from "../lib/dockerfile.js";

export interface InitPrompts {
  chooseAgent(): Promise<AgentName>;
  enterTestCommand(): Promise<string>;
  confirmOverwrite(configDirectory: string): Promise<boolean>;
}

export interface InitializeProjectOptions {
  cwd: string;
  prompts: InitPrompts;
  stdout: Pick<Writable, "write">;
}

export async function initializeProject(options: InitializeProjectOptions): Promise<void> {
  const { cwd, prompts, stdout } = options;
  const paths = getCodingFactoryPaths(cwd);
  const configDirectoryExists = await directoryExists(paths.configDirectory);

  if (configDirectoryExists) {
    const shouldOverwrite = await prompts.confirmOverwrite(paths.configDirectory);

    if (!shouldOverwrite) {
      stdout.write("Initialization cancelled.\n");
      return;
    }
  }

  const agent = await prompts.chooseAgent();
  const testCommand = await prompts.enterTestCommand();

  if (!testCommand.trim()) {
    throw new Error("Test command cannot be empty.");
  }

  await mkdir(paths.configDirectory, { recursive: true });
  await writeFile(paths.envPath, buildEnvTemplate(agent), "utf8");
  await writeFile(paths.configPath, serializeConfig(buildConfig(cwd, { agent, testCommand })), "utf8");
  await writeFile(paths.dockerfilePath, buildDockerfile(agent), "utf8");

  stdout.write(`Created ${paths.configDirectory}\n`);
  stdout.write(`Update ${paths.envPath} with your secrets before running issue orchestration.\n`);
}

async function directoryExists(directoryPath: string): Promise<boolean> {
  try {
    await access(directoryPath);
    await readdir(directoryPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function buildEnvTemplate(agent: AgentName): string {
  const lines = [
    "# Fill in these values before running `coding-factory issue <number>`."
  ];

  if (agent === "codex") {
    lines.push("OPENAI_API_KEY=");
  } else {
    lines.push("ANTHROPIC_API_KEY=");
  }

  lines.push("GITHUB_TOKEN=");

  return `${lines.join("\n")}\n`;
}
