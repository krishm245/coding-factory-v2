import { describe, expect, it, vi, type Mock } from "vitest";
import type {
  CommandRunOptions,
  CommandRunResult,
} from "../src/lib/command-runner.js";
import {
  DockerWorkerService,
  type DockerWorkerServiceDependencies,
} from "../src/lib/docker-worker-service.js";

type TestCommandRunner = {
  run: Mock<DockerWorkerServiceDependencies["commandRunner"]["run"]>;
};

function createResult(
  overrides: Partial<CommandRunResult> = {},
): CommandRunResult {
  return {
    exitCode: 0,
    stderr: "",
    stdout: "",
    ...overrides,
  };
}

function createCommandRunner(
  results: CommandRunResult[],
): TestCommandRunner {
  return {
    run: vi
      .fn<DockerWorkerServiceDependencies["commandRunner"]["run"]>()
      .mockImplementation(
        async (
          _command: string,
          _args: readonly string[],
          _options: CommandRunOptions,
        ) => {
          const nextResult = results.shift();

          if (!nextResult) {
            throw new Error("Unexpected command execution.");
          }

          return nextResult;
        },
      ),
  };
}

describe("DockerWorkerService", () => {
  it("builds the configured image and starts one long-lived worker container", async () => {
    const commandRunner = createCommandRunner([
      createResult(),
      createResult({ exitCode: 1, stderr: "No such container" }),
      createResult({ stdout: "created-container-id\n" }),
      createResult({ stdout: "started-container-id\n" }),
    ]);
    const service = new DockerWorkerService({ commandRunner });

    await expect(
      service.startWorker({
        cwd: "/repo",
        dockerfilePath: ".coding-factory/Dockerfile",
        imageName: "coding-factory-repo",
        issueNumber: 42,
      }),
    ).resolves.toEqual({
      containerName: "coding-factory-repo-issue-42",
      cwd: "/repo",
      imageName: "coding-factory-repo",
      workspacePath: "/workspace",
    });

    expect(commandRunner.run).toHaveBeenNthCalledWith(
      1,
      "docker",
      [
        "build",
        "-t",
        "coding-factory-repo",
        "-f",
        "/repo/.coding-factory/Dockerfile",
        "/repo",
      ],
      { cwd: "/repo" },
    );
    expect(commandRunner.run).toHaveBeenNthCalledWith(
      2,
      "docker",
      ["container", "inspect", "coding-factory-repo-issue-42"],
      { cwd: "/repo" },
    );
    expect(commandRunner.run).toHaveBeenNthCalledWith(
      3,
      "docker",
      [
        "create",
        "--name",
        "coding-factory-repo-issue-42",
        "--env-file",
        "/repo/.coding-factory/.env",
        "--volume",
        "/repo:/workspace",
        "--workdir",
        "/workspace",
        "coding-factory-repo",
        "tail",
        "-f",
        "/dev/null",
      ],
      { cwd: "/repo" },
    );
    expect(commandRunner.run).toHaveBeenNthCalledWith(
      4,
      "docker",
      ["start", "coding-factory-repo-issue-42"],
      { cwd: "/repo" },
    );
  });

  it("replaces a stale same-name worker container before creating a new one", async () => {
    const commandRunner = createCommandRunner([
      createResult(),
      createResult({ stdout: "existing-container\n" }),
      createResult({ stdout: "coding-factory-repo-issue-42\n" }),
      createResult({ stdout: "created-container-id\n" }),
      createResult({ stdout: "started-container-id\n" }),
    ]);
    const service = new DockerWorkerService({ commandRunner });

    await service.startWorker({
      cwd: "/repo",
      dockerfilePath: ".coding-factory/Dockerfile",
      imageName: "coding-factory-repo",
      issueNumber: 42,
    });

    expect(commandRunner.run).toHaveBeenNthCalledWith(
      3,
      "docker",
      ["rm", "-f", "coding-factory-repo-issue-42"],
      { cwd: "/repo" },
    );
  });

  it("tries to remove a partially created worker if startup fails", async () => {
    const commandRunner = createCommandRunner([
      createResult(),
      createResult({ exitCode: 1, stderr: "No such container" }),
      createResult({ stdout: "created-container-id\n" }),
      createResult({ exitCode: 1, stderr: "failed to start" }),
      createResult({ stdout: "coding-factory-repo-issue-42\n" }),
    ]);
    const service = new DockerWorkerService({ commandRunner });

    await expect(
      service.startWorker({
        cwd: "/repo",
        dockerfilePath: ".coding-factory/Dockerfile",
        imageName: "coding-factory-repo",
        issueNumber: 42,
      }),
    ).rejects.toThrow(
      'Failed to start Docker worker "coding-factory-repo-issue-42": failed to start',
    );

    expect(commandRunner.run).toHaveBeenNthCalledWith(
      5,
      "docker",
      ["rm", "-f", "coding-factory-repo-issue-42"],
      { cwd: "/repo" },
    );
  });

  it("attempts both stop and remove during cleanup", async () => {
    const commandRunner = createCommandRunner([
      createResult({ exitCode: 1, stderr: "container already stopped" }),
      createResult(),
    ]);
    const service = new DockerWorkerService({ commandRunner });

    await expect(
      service.cleanupWorker({
        containerName: "coding-factory-repo-issue-42",
        cwd: "/repo",
        imageName: "coding-factory-repo",
        workspacePath: "/workspace",
      }),
    ).rejects.toThrow(
      'Failed to stop Docker worker "coding-factory-repo-issue-42": container already stopped',
    );

    expect(commandRunner.run).toHaveBeenNthCalledWith(
      1,
      "docker",
      ["stop", "coding-factory-repo-issue-42"],
      { cwd: "/repo" },
    );
    expect(commandRunner.run).toHaveBeenNthCalledWith(
      2,
      "docker",
      ["rm", "coding-factory-repo-issue-42"],
      { cwd: "/repo" },
    );
  });

  it("runs commands inside the started worker container", async () => {
    const commandRunner = createCommandRunner([createResult({ stdout: "{}\n" })]);
    const service = new DockerWorkerService({ commandRunner });

    await expect(
      service.runCommandInWorker(
        {
          containerName: "coding-factory-repo-issue-42",
          cwd: "/repo",
          imageName: "coding-factory-repo",
          workspacePath: "/workspace",
        },
        {
          command: "gh",
          args: ["issue", "view", "42", "--json", "title,body"],
        },
      ),
    ).resolves.toEqual(createResult({ stdout: "{}\n" }));

    expect(commandRunner.run).toHaveBeenCalledWith(
      "docker",
      [
        "exec",
        "--workdir",
        "/workspace",
        "coding-factory-repo-issue-42",
        "gh",
        "issue",
        "view",
        "42",
        "--json",
        "title,body",
      ],
      { cwd: "/repo" },
    );
  });
});
