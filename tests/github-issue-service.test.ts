import { describe, expect, it, vi, type Mock } from "vitest";
import type { CommandRunResult } from "../src/lib/command-runner.js";
import type {
  DockerWorkerHandle,
} from "../src/lib/docker-worker-service.js";
import {
  GitHubIssueService,
  type GitHubIssueServiceDependencies,
} from "../src/lib/github-issue-service.js";

type TestDockerWorkerService = {
  runCommandInWorker: Mock<
    GitHubIssueServiceDependencies["dockerWorkerService"]["runCommandInWorker"]
  >;
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

function createDockerWorkerService(
  results: CommandRunResult[],
): TestDockerWorkerService {
  return {
    runCommandInWorker: vi
      .fn<
        GitHubIssueServiceDependencies["dockerWorkerService"]["runCommandInWorker"]
      >()
      .mockImplementation(async () => {
        const nextResult = results.shift();

        if (!nextResult) {
          throw new Error("Unexpected worker command execution.");
        }

        return nextResult;
      }),
  };
}

function getWorker(): DockerWorkerHandle {
  return {
    containerName: "coding-factory-repo-issue-42",
    cwd: "/repo",
    imageName: "coding-factory-repo",
    workspacePath: "/workspace",
  };
}

describe("GitHubIssueService", () => {
  it("fetches the title and body through gh inside the worker", async () => {
    const dockerWorkerService = createDockerWorkerService([
      createResult({ stdout: "token\n" }),
      createResult({ stdout: '{"title":"Fix login","body":"Implement the fix."}\n' }),
    ]);
    const service = new GitHubIssueService({ dockerWorkerService });
    const worker = getWorker();

    await expect(
      service.fetchIssue({
        issueNumber: 42,
        worker,
      }),
    ).resolves.toEqual({
      body: "Implement the fix.",
      number: 42,
      title: "Fix login",
    });

    expect(dockerWorkerService.runCommandInWorker).toHaveBeenNthCalledWith(
      1,
      worker,
      {
        args: ["GITHUB_TOKEN"],
        command: "printenv",
      },
    );
    expect(dockerWorkerService.runCommandInWorker).toHaveBeenNthCalledWith(
      2,
      worker,
      {
        args: ["issue", "view", "42", "--json", "title,body"],
        command: "gh",
      },
    );
  });

  it("fails before gh execution when the GitHub token is missing", async () => {
    const dockerWorkerService = createDockerWorkerService([
      createResult({ exitCode: 1 }),
    ]);
    const service = new GitHubIssueService({ dockerWorkerService });

    await expect(
      service.fetchIssue({
        issueNumber: 42,
        worker: getWorker(),
      }),
    ).rejects.toThrow(
      "Missing GitHub token. Set GITHUB_TOKEN in .coding-factory/.env before running `coding-factory issue <number>`.",
    );

    expect(dockerWorkerService.runCommandInWorker).toHaveBeenCalledTimes(1);
  });

  it("surfaces gh command failures with context", async () => {
    const dockerWorkerService = createDockerWorkerService([
      createResult({ stdout: "token\n" }),
      createResult({ exitCode: 1, stderr: "issue not found" }),
    ]);
    const service = new GitHubIssueService({ dockerWorkerService });

    await expect(
      service.fetchIssue({
        issueNumber: 42,
        worker: getWorker(),
      }),
    ).rejects.toThrow("Failed to fetch GitHub issue #42: issue not found");
  });

  it("rejects invalid JSON output from gh", async () => {
    const dockerWorkerService = createDockerWorkerService([
      createResult({ stdout: "token\n" }),
      createResult({ stdout: "not-json\n" }),
    ]);
    const service = new GitHubIssueService({ dockerWorkerService });

    await expect(
      service.fetchIssue({
        issueNumber: 42,
        worker: getWorker(),
      }),
    ).rejects.toThrow(
      "Failed to parse GitHub issue #42: expected valid JSON output from gh.",
    );
  });

  it("rejects issues with a blank title", async () => {
    const dockerWorkerService = createDockerWorkerService([
      createResult({ stdout: "token\n" }),
      createResult({ stdout: '{"title":"   ","body":"Has body"}\n' }),
    ]);
    const service = new GitHubIssueService({ dockerWorkerService });

    await expect(
      service.fetchIssue({
        issueNumber: 42,
        worker: getWorker(),
      }),
    ).rejects.toThrow("GitHub issue #42 is missing a title.");
  });

  it("rejects issues with a blank body", async () => {
    const dockerWorkerService = createDockerWorkerService([
      createResult({ stdout: "token\n" }),
      createResult({ stdout: '{"title":"Valid","body":"   "}\n' }),
    ]);
    const service = new GitHubIssueService({ dockerWorkerService });

    await expect(
      service.fetchIssue({
        issueNumber: 42,
        worker: getWorker(),
      }),
    ).rejects.toThrow("GitHub issue #42 is missing a body.");
  });
});
