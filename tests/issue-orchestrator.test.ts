import { describe, expect, it, vi } from "vitest";
import { IssueOrchestrator } from "../src/lib/issue-orchestrator.js";
import type { CodingFactoryConfig } from "../src/lib/config.js";

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

describe("IssueOrchestrator", () => {
  it("rejects invalid issue numbers before loading config", async () => {
    const load = vi.fn(async () => null);
    const orchestrator = new IssueOrchestrator({
      configStore: { load },
    });

    await expect(
      orchestrator.run({ cwd: "/repo", issueNumber: "0" }),
    ).rejects.toThrow("Issue number must be a positive integer.");
    expect(load).not.toHaveBeenCalled();
  });

  it("fails when the project is not initialized", async () => {
    const load = vi.fn(async () => null);
    const orchestrator = new IssueOrchestrator({
      configStore: { load },
    });

    await expect(
      orchestrator.run({ cwd: "/repo", issueNumber: "42" }),
    ).rejects.toThrow(
      "Project is not initialized. Run `coding-factory init` first.",
    );
    expect(load).toHaveBeenCalledWith("/repo");
  });

  it("returns the prepared context with the loaded config", async () => {
    const orchestrator = new IssueOrchestrator({
      configStore: { load: vi.fn(async () => getConfig()) },
    });

    await expect(
      orchestrator.run({ cwd: "/repo", issueNumber: "42" }),
    ).resolves.toEqual({
      cwd: "/repo",
      issueNumber: 42,
      config: {
        version: 1,
        defaultAgent: "codex",
        testCommand: "pnpm test",
        dockerfilePath: ".coding-factory/Dockerfile",
        branchPrefix: "coding-factory",
        requirementsDocPath: "docs",
        imageName: "coding-factory-repo",
      },
    });
  });
});
