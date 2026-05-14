import { describe, expect, it, vi } from "vitest";
import type { CodingFactoryConfig } from "../src/lib/config.js";
import type { DockerWorkerHandle } from "../src/lib/docker-worker-service.js";
import { IssueWorkflowRunner } from "../src/lib/issue-workflow-runner.js";

function getConfig(): CodingFactoryConfig {
  return {
    version: 1,
    defaultAgent: "codex",
    testCommand: "pnpm test",
    dockerfilePath: ".coding-factory/Dockerfile",
    branchPrefix: "coding-factory",
    requirementsDocPath: "docs",
    imageName: "coding-factory-repo",
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

describe("IssueWorkflowRunner", () => {
  it("fetches the issue through the GitHub service", async () => {
    const fetchIssue = vi.fn(async () => ({
      body: "Implement the fix.",
      number: 42,
      title: "Fix login",
    }));
    const runner = new IssueWorkflowRunner({
      gitHubIssueService: {
        fetchIssue,
      },
    });
    const worker = getWorker();

    await expect(
      runner.run({
        branchName: "coding-factory/issue-42",
        config: getConfig(),
        cwd: "/repo",
        issueNumber: 42,
        worker,
      }),
    ).resolves.toBeUndefined();

    expect(fetchIssue).toHaveBeenCalledWith({
      issueNumber: 42,
      worker,
    });
  });

  it("surfaces GitHub fetch failures unchanged", async () => {
    const runner = new IssueWorkflowRunner({
      gitHubIssueService: {
        fetchIssue: vi.fn(async () => {
          throw new Error("Failed to fetch GitHub issue #42: issue not found");
        }),
      },
    });

    await expect(
      runner.run({
        branchName: "coding-factory/issue-42",
        config: getConfig(),
        cwd: "/repo",
        issueNumber: 42,
        worker: getWorker(),
      }),
    ).rejects.toThrow("Failed to fetch GitHub issue #42: issue not found");
  });
});
