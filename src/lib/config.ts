import { readFile } from "node:fs/promises";
import path from "node:path";

export const CONFIG_DIRECTORY = ".coding-factory";
export const CONFIG_FILE = "config.json";
export const ENV_FILE = ".env";
export const DOCKERFILE_FILE = "Dockerfile";

export type AgentName = "codex" | "claude";

export interface CodingFactoryConfig {
  version: 1;
  defaultAgent: AgentName;
  testCommand: string;
  dockerfilePath: string;
  branchPrefix: string;
  requirementsDocPath: string;
  imageName: string;
}

export interface CodingFactoryPaths {
  configDirectory: string;
  configPath: string;
  envPath: string;
  dockerfilePath: string;
}

export function getCodingFactoryPaths(cwd: string): CodingFactoryPaths {
  const configDirectory = path.join(cwd, CONFIG_DIRECTORY);

  return {
    configDirectory,
    configPath: path.join(configDirectory, CONFIG_FILE),
    envPath: path.join(configDirectory, ENV_FILE),
    dockerfilePath: path.join(configDirectory, DOCKERFILE_FILE)
  };
}

export function buildConfig(cwd: string, input: { agent: AgentName; testCommand: string }): CodingFactoryConfig {
  return {
    version: 1,
    defaultAgent: input.agent,
    testCommand: input.testCommand,
    dockerfilePath: path.posix.join(CONFIG_DIRECTORY, DOCKERFILE_FILE),
    branchPrefix: "coding-factory",
    requirementsDocPath: "docs",
    imageName: buildImageName(cwd)
  };
}

export function serializeConfig(config: CodingFactoryConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export async function readConfig(cwd: string): Promise<CodingFactoryConfig | null> {
  const { configPath } = getCodingFactoryPaths(cwd);

  try {
    const rawConfig = await readFile(configPath, "utf8");
    return JSON.parse(rawConfig) as CodingFactoryConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function buildImageName(cwd: string): string {
  const repoName = path.basename(cwd) || "workspace";
  const normalizedName = repoName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `coding-factory-${normalizedName || "workspace"}`;
}
