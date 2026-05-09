import {
  access as fsAccess,
  mkdir as fsMkdir,
  readdir as fsReaddir,
  writeFile as fsWriteFile
} from "node:fs/promises";
import { AgentRuntimeCatalog, type AgentName } from "./agent-runtime.js";
import {
  CodingFactoryConfigStore,
  type CodingFactoryPaths
} from "./config.js";

export interface ProjectInitializationFileSystem {
  access(path: string): Promise<void>;
  mkdir(path: string, options: { recursive: true }): Promise<string | undefined>;
  readdir(path: string): Promise<string[]>;
  writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
}

export interface ProjectInitializationInspection {
  exists: boolean;
  paths: CodingFactoryPaths;
}

export interface ProjectInitializationRequest {
  cwd: string;
  defaultAgent: AgentName;
  testCommand: string;
}

export interface ProjectInitializationResult {
  paths: CodingFactoryPaths;
}

export interface ProjectInitializerDependencies {
  agentRuntimeCatalog: Pick<
    AgentRuntimeCatalog,
    "buildDockerfile" | "buildEnvTemplate"
  >;
  configStore: Pick<CodingFactoryConfigStore, "create" | "getPaths" | "serialize">;
  fileSystem: ProjectInitializationFileSystem;
}

export class ProjectInitializer {
  constructor(private readonly dependencies: ProjectInitializerDependencies) {}

  async inspect(cwd: string): Promise<ProjectInitializationInspection> {
    const paths = this.dependencies.configStore.getPaths(cwd);

    return {
      exists: await this.directoryExists(paths.configDirectory),
      paths
    };
  }

  async initialize(
    request: ProjectInitializationRequest
  ): Promise<ProjectInitializationResult> {
    const testCommand = request.testCommand.trim();

    if (!testCommand) {
      throw new Error("Test command cannot be empty.");
    }

    const paths = this.dependencies.configStore.getPaths(request.cwd);
    const config = this.dependencies.configStore.create(request.cwd, {
      defaultAgent: request.defaultAgent,
      testCommand
    });

    await this.dependencies.fileSystem.mkdir(paths.configDirectory, { recursive: true });
    await this.dependencies.fileSystem.writeFile(
      paths.envPath,
      this.dependencies.agentRuntimeCatalog.buildEnvTemplate(request.defaultAgent),
      "utf8"
    );
    await this.dependencies.fileSystem.writeFile(
      paths.configPath,
      this.dependencies.configStore.serialize(config),
      "utf8"
    );
    await this.dependencies.fileSystem.writeFile(
      paths.dockerfilePath,
      this.dependencies.agentRuntimeCatalog.buildDockerfile(request.defaultAgent),
      "utf8"
    );

    return { paths };
  }

  private async directoryExists(directoryPath: string): Promise<boolean> {
    try {
      await this.dependencies.fileSystem.access(directoryPath);
      await this.dependencies.fileSystem.readdir(directoryPath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }

      throw error;
    }
  }
}

export const nodeProjectInitializationFileSystem: ProjectInitializationFileSystem = {
  access: fsAccess,
  mkdir: fsMkdir,
  readdir: fsReaddir,
  writeFile: fsWriteFile
};
