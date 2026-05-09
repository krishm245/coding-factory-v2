import { readFile as fsReadFile } from "node:fs/promises";
import path from "node:path";
import type { AgentName } from "./agent-runtime.js";

export const CONFIG_DIRECTORY = ".coding-factory";
export const CONFIG_FILE = "config.json";
export const ENV_FILE = ".env";
export const DOCKERFILE_FILE = "Dockerfile";

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

export interface ConfigFileSystem {
  readFile(path: string, encoding: "utf8"): Promise<string>;
}

export class InvalidCodingFactoryConfigError extends Error {
  constructor(configPath: string, reason: string) {
    super(`Invalid config at ${configPath}: ${reason}`);
    this.name = "InvalidCodingFactoryConfigError";
  }
}

export class CodingFactoryConfigStore {
  constructor(private readonly fileSystem: ConfigFileSystem) {}

  create(
    cwd: string,
    input: { defaultAgent: AgentName; testCommand: string }
  ): CodingFactoryConfig {
    return {
      version: 1,
      defaultAgent: input.defaultAgent,
      testCommand: input.testCommand,
      dockerfilePath: path.posix.join(CONFIG_DIRECTORY, DOCKERFILE_FILE),
      branchPrefix: "coding-factory",
      requirementsDocPath: "docs",
      imageName: buildImageName(cwd)
    };
  }

  getPaths(cwd: string): CodingFactoryPaths {
    const configDirectory = path.join(cwd, CONFIG_DIRECTORY);

    return {
      configDirectory,
      configPath: path.join(configDirectory, CONFIG_FILE),
      envPath: path.join(configDirectory, ENV_FILE),
      dockerfilePath: path.join(configDirectory, DOCKERFILE_FILE)
    };
  }

  async load(cwd: string): Promise<CodingFactoryConfig | null> {
    const { configPath } = this.getPaths(cwd);

    try {
      const rawConfig = await this.fileSystem.readFile(configPath, "utf8");
      return parseConfig(rawConfig, configPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  serialize(config: CodingFactoryConfig): string {
    return `${JSON.stringify(config, null, 2)}\n`;
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

function parseConfig(rawConfig: string, configPath: string): CodingFactoryConfig {
  let parsedConfig: unknown;

  try {
    parsedConfig = JSON.parse(rawConfig);
  } catch {
    throw new InvalidCodingFactoryConfigError(configPath, "File is not valid JSON.");
  }

  if (!isRecord(parsedConfig)) {
    throw new InvalidCodingFactoryConfigError(
      configPath,
      "Top-level value must be an object."
    );
  }

  return {
    version: readLiteralNumberField(parsedConfig, "version", 1, configPath),
    defaultAgent: readAgentField(parsedConfig, configPath),
    testCommand: readStringField(parsedConfig, "testCommand", configPath),
    dockerfilePath: readStringField(parsedConfig, "dockerfilePath", configPath),
    branchPrefix: readStringField(parsedConfig, "branchPrefix", configPath),
    requirementsDocPath: readStringField(parsedConfig, "requirementsDocPath", configPath),
    imageName: readStringField(parsedConfig, "imageName", configPath)
  };
}

function isAgentName(value: unknown): value is AgentName {
  return value === "codex" || value === "claude";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readAgentField(
  configRecord: Record<string, unknown>,
  configPath: string
): AgentName {
  const value = configRecord.defaultAgent;

  if (!isAgentName(value)) {
    throw new InvalidCodingFactoryConfigError(
      configPath,
      'Expected "defaultAgent" to be "codex" or "claude".'
    );
  }

  return value;
}

function readLiteralNumberField(
  configRecord: Record<string, unknown>,
  fieldName: "version",
  expectedValue: 1,
  configPath: string
): 1 {
  const value = configRecord[fieldName];

  if (value !== expectedValue) {
    throw new InvalidCodingFactoryConfigError(
      configPath,
      `Expected "${fieldName}" to be ${expectedValue}.`
    );
  }

  return expectedValue;
}

function readStringField(
  configRecord: Record<string, unknown>,
  fieldName:
    | "branchPrefix"
    | "dockerfilePath"
    | "imageName"
    | "requirementsDocPath"
    | "testCommand",
  configPath: string
): string {
  const value = configRecord[fieldName];

  if (typeof value !== "string") {
    throw new InvalidCodingFactoryConfigError(
      configPath,
      `Expected "${fieldName}" to be a string.`
    );
  }

  return value;
}

export const nodeConfigFileSystem: ConfigFileSystem = {
  readFile: fsReadFile
};
