import {
  access as fsAccess,
  mkdir as fsMkdir,
  readdir as fsReaddir,
  writeFile as fsWriteFile
} from "node:fs/promises";
import type { Writable } from "node:stream";
import { buildConfig, getCodingFactoryPaths, serializeConfig, type AgentName } from "../lib/config.js";
import { buildDockerfile } from "../lib/dockerfile.js";

export interface InitPrompts {
  chooseAgent(): Promise<AgentName>;
  enterTestCommand(): Promise<string>;
  confirmOverwrite(configDirectory: string): Promise<boolean>;
}

export interface InitFileSystem {
  access(path: string): Promise<void>;
  mkdir(path: string, options: { recursive: true }): Promise<string | undefined>;
  readdir(path: string): Promise<string[]>;
  writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
}

export interface InitializeProjectOptions {
  cwd: string;
  prompts: InitPrompts;
  stdout: Pick<Writable, "write">;
  fileSystem?: InitFileSystem;
}

export async function initializeProject(options: InitializeProjectOptions): Promise<void> {
  const { cwd, prompts, stdout, fileSystem = nodeFileSystem } = options;
  const paths = getCodingFactoryPaths(cwd);
  const configDirectoryExists = await directoryExists(paths.configDirectory, fileSystem);

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

  await fileSystem.mkdir(paths.configDirectory, { recursive: true });
  await fileSystem.writeFile(paths.envPath, buildEnvTemplate(agent), "utf8");
  await fileSystem.writeFile(
    paths.configPath,
    serializeConfig(buildConfig(cwd, { agent, testCommand })),
    "utf8"
  );
  await fileSystem.writeFile(paths.dockerfilePath, buildDockerfile(agent), "utf8");

  stdout.write(`Created ${paths.configDirectory}\n`);
  stdout.write(`Update ${paths.envPath} with your secrets before running issue orchestration.\n`);
}

const nodeFileSystem: InitFileSystem = {
  access: fsAccess,
  mkdir: fsMkdir,
  readdir: fsReaddir,
  writeFile: fsWriteFile
};

async function directoryExists(directoryPath: string, fileSystem: InitFileSystem): Promise<boolean> {
  try {
    await fileSystem.access(directoryPath);
    await fileSystem.readdir(directoryPath);
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
