import { describe, expect, it, vi } from "vitest";
import { IssueCommand } from "../src/commands/issue.js";
import type { CodingFactoryConfig } from "../src/lib/config.js";
import type { IssueOrchestrationContext } from "../src/lib/issue-orchestrator.js";

function getIssueOrchestrationContext(): IssueOrchestrationContext {
  return {
    cwd: "/repo",
    issueNumber: 42,
    config: getConfig(),
  };
}

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

describe("IssueCommand", () => {
  it("delegates the issue run to the orchestration seam", async () => {
    const issueOrchestrator = {
      run: vi.fn(async () => getIssueOrchestrationContext()),
    };

    await new IssueCommand({
      getCwd: () => "/repo",
      issueOrchestrator,
    }).run("42");

    expect(issueOrchestrator.run).toHaveBeenCalledWith({
      cwd: "/repo",
      issueNumber: "42",
    });
  });

  it("surfaces orchestration failures unchanged", async () => {
    const issueOrchestrator = {
      run: vi.fn(async () => {
        throw new Error(
          "Project is not initialized. Run `coding-factory init` first.",
        );
      }),
    };

    await expect(
      new IssueCommand({
        getCwd: () => "/repo",
        issueOrchestrator,
      }).run("42"),
    ).rejects.toThrow(
      "Project is not initialized. Run `coding-factory init` first.",
    );
  });
});
