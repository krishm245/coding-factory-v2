import path from "node:path";
import { NodeCommandRunner, type CommandRunResult } from "./command-runner.js";

const WORKSPACE_PATH = "/workspace";
const IDLE_COMMAND = ["tail", "-f", "/dev/null"] as const;

export interface DockerWorkerStartRequest {
  cwd: string;
  dockerfilePath: string;
  imageName: string;
  issueNumber: number;
}

export interface DockerWorkerHandle {
  containerName: string;
  cwd: string;
  imageName: string;
  workspacePath: string;
}

export interface DockerWorkerServiceDependencies {
  commandRunner: Pick<NodeCommandRunner, "run">;
}

export class DockerWorkerService {
  constructor(private readonly dependencies: DockerWorkerServiceDependencies) {}

  async startWorker(
    request: DockerWorkerStartRequest,
  ): Promise<DockerWorkerHandle> {
    const dockerfilePath = path.resolve(request.cwd, request.dockerfilePath);
    const containerName = this.buildContainerName(
      request.imageName,
      request.issueNumber,
    );

    await this.buildImage(request.cwd, request.imageName, dockerfilePath);
    await this.removeStaleContainer(request.cwd, containerName);

    let containerCreated = false;

    try {
      await this.createContainer(request.cwd, request.imageName, containerName);
      containerCreated = true;
      await this.startContainer(request.cwd, containerName);
    } catch (error) {
      if (containerCreated) {
        const cleanupError = await this.tryRemoveContainer(
          request.cwd,
          containerName,
        );

        if (cleanupError) {
          throw this.appendErrorDetails(
            this.ensureError(error),
            `Failed to clean up partially created Docker worker "${containerName}": ${cleanupError.message}`,
          );
        }
      }

      throw error;
    }

    return {
      containerName,
      cwd: request.cwd,
      imageName: request.imageName,
      workspacePath: WORKSPACE_PATH,
    };
  }

  async cleanupWorker(handle: DockerWorkerHandle): Promise<void> {
    const cleanupErrors: string[] = [];
    const stopResult = await this.runDocker(handle.cwd, [
      "stop",
      handle.containerName,
    ]);

    if (stopResult.exitCode !== 0) {
      cleanupErrors.push(
        this.createDockerCommandError(
          stopResult,
          `stop Docker worker "${handle.containerName}"`,
        ).message,
      );
    }

    const removeResult = await this.runDocker(handle.cwd, [
      "rm",
      handle.containerName,
    ]);

    if (removeResult.exitCode !== 0) {
      cleanupErrors.push(
        this.createDockerCommandError(
          removeResult,
          `remove Docker worker "${handle.containerName}"`,
        ).message,
      );
    }

    if (cleanupErrors.length > 0) {
      throw new Error(cleanupErrors.join(" "));
    }
  }

  private async buildImage(
    cwd: string,
    imageName: string,
    dockerfilePath: string,
  ): Promise<void> {
    const result = await this.runDocker(cwd, [
      "build",
      "-t",
      imageName,
      "-f",
      dockerfilePath,
      cwd,
    ]);

    this.assertDockerCommandSucceeded(
      result,
      `build Docker image "${imageName}"`,
    );
  }

  private async removeStaleContainer(
    cwd: string,
    containerName: string,
  ): Promise<void> {
    const exists = await this.containerExists(cwd, containerName);

    if (!exists) {
      return;
    }

    const result = await this.runDocker(cwd, ["rm", "-f", containerName]);

    this.assertDockerCommandSucceeded(
      result,
      `remove stale Docker worker "${containerName}"`,
    );
  }

  private async containerExists(
    cwd: string,
    containerName: string,
  ): Promise<boolean> {
    const result = await this.runDocker(cwd, [
      "container",
      "inspect",
      containerName,
    ]);

    if (result.exitCode === 0) {
      return true;
    }

    if (result.exitCode === 1) {
      return false;
    }

    throw this.createDockerCommandError(
      result,
      `inspect Docker worker "${containerName}"`,
    );
  }

  private async createContainer(
    cwd: string,
    imageName: string,
    containerName: string,
  ): Promise<void> {
    const result = await this.runDocker(cwd, [
      "create",
      "--name",
      containerName,
      "--volume",
      `${cwd}:${WORKSPACE_PATH}`,
      "--workdir",
      WORKSPACE_PATH,
      imageName,
      ...IDLE_COMMAND,
    ]);

    this.assertDockerCommandSucceeded(
      result,
      `create Docker worker "${containerName}"`,
    );
  }

  private async startContainer(
    cwd: string,
    containerName: string,
  ): Promise<void> {
    const result = await this.runDocker(cwd, ["start", containerName]);

    this.assertDockerCommandSucceeded(
      result,
      `start Docker worker "${containerName}"`,
    );
  }

  private async tryRemoveContainer(
    cwd: string,
    containerName: string,
  ): Promise<Error | null> {
    const result = await this.runDocker(cwd, ["rm", "-f", containerName]);

    if (result.exitCode === 0) {
      return null;
    }

    return this.createDockerCommandError(
      result,
      `remove Docker worker "${containerName}"`,
    );
  }

  private buildContainerName(imageName: string, issueNumber: number): string {
    const normalizedImageName = imageName
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "");

    return `${normalizedImageName || "coding-factory"}-issue-${issueNumber}`;
  }

  private async runDocker(
    cwd: string,
    args: readonly string[],
  ): Promise<CommandRunResult> {
    return this.dependencies.commandRunner.run("docker", args, { cwd });
  }

  private assertDockerCommandSucceeded(
    result: CommandRunResult,
    action: string,
  ): void {
    if (result.exitCode !== 0) {
      throw this.createDockerCommandError(result, action);
    }
  }

  private createDockerCommandError(
    result: CommandRunResult,
    action: string,
  ): Error {
    const output = [result.stderr.trim(), result.stdout.trim()]
      .filter((value) => value.length > 0)
      .join(" ");

    if (output) {
      return new Error(`Failed to ${action}: ${output}`);
    }

    return new Error(`Failed to ${action}.`);
  }

  private appendErrorDetails(error: Error, details: string): Error {
    return new Error(`${error.message} ${details}`);
  }

  private ensureError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }
}
