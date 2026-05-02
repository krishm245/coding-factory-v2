import { describe, expect, it, vi } from "vitest";
import { IssueCommand } from "../src/commands/issue.js";
import type { CodingFactoryConfig } from "../src/lib/config.js";
import type { IssueOrchestrationResult } from "../src/lib/issue-orchestrator.js";

describe("IssueCommand", () => {
  it("writes the current placeholder orchestration message", async () => {
    const stdout = {
      write: vi.fn<(chunk: string | Uint8Array) => boolean>(() => true),
    };
    const issueOrchestrator = {
      run: vi.fn(async () => createIssueOrchestrationResult()),
    };

    await new IssueCommand({
      getCwd: () => "/repo",
      issueOrchestrator,
      stdout,
    }).run("42");

    expect(issueOrchestrator.run).toHaveBeenCalledWith({
      cwd: "/repo",
      issueNumber: "42",
    });
    expect(stdout.write).toHaveBeenCalledWith(
      "Issue orchestration for #42 is not implemented yet. Current default agent: codex.\n",
    );
  });
});

function createIssueOrchestrationResult(): IssueOrchestrationResult {
  return {
    issueNumber: 42,
    config: createConfig(),
  };
}

function createConfig(): CodingFactoryConfig {
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
