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

export class ProjectInitializer {
  constructor(
    private readonly fileSystem: ProjectInitializationFileSystem = nodeFileSystem,
    private readonly configStore: CodingFactoryConfigStore = new CodingFactoryConfigStore(),
    private readonly agentRuntimeCatalog: AgentRuntimeCatalog = new AgentRuntimeCatalog()
  ) {}

  async inspect(cwd: string): Promise<ProjectInitializationInspection> {
    const paths = this.configStore.getPaths(cwd);

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

    const paths = this.configStore.getPaths(request.cwd);
    const config = this.configStore.create(request.cwd, {
      defaultAgent: request.defaultAgent,
      testCommand
    });

    await this.fileSystem.mkdir(paths.configDirectory, { recursive: true });
    await this.fileSystem.writeFile(
      paths.envPath,
      this.agentRuntimeCatalog.buildEnvTemplate(request.defaultAgent),
      "utf8"
    );
    await this.fileSystem.writeFile(
      paths.configPath,
      this.configStore.serialize(config),
      "utf8"
    );
    await this.fileSystem.writeFile(
      paths.dockerfilePath,
      this.agentRuntimeCatalog.buildDockerfile(request.defaultAgent),
      "utf8"
    );

    return { paths };
  }

  private async directoryExists(directoryPath: string): Promise<boolean> {
    try {
      await this.fileSystem.access(directoryPath);
      await this.fileSystem.readdir(directoryPath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }

      throw error;
    }
  }
}

const nodeFileSystem: ProjectInitializationFileSystem = {
  access: fsAccess,
  mkdir: fsMkdir,
  readdir: fsReaddir,
  writeFile: fsWriteFile
};
