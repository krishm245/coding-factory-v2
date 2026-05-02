import { describe, expect, it, vi } from "vitest";
import { IssueOrchestrator } from "../src/lib/issue-orchestrator.js";
import type { CodingFactoryConfig } from "../src/lib/config.js";

describe("IssueOrchestrator", () => {
  it("rejects invalid issue numbers before loading config", async () => {
    const load = vi.fn(async () => null);
    const orchestrator = new IssueOrchestrator({ load });

    await expect(
      orchestrator.run({ cwd: "/repo", issueNumber: "0" })
    ).rejects.toThrow("Issue number must be a positive integer.");
    expect(load).not.toHaveBeenCalled();
  });

  it("fails when the project is not initialized", async () => {
    const orchestrator = new IssueOrchestrator({
      load: vi.fn(async () => null)
    });

    await expect(
      orchestrator.run({ cwd: "/repo", issueNumber: "42" })
    ).rejects.toThrow("Project is not initialized. Run `coding-factory init` first.");
  });

  it("returns the loaded config and parsed issue number", async () => {
    const orchestrator = new IssueOrchestrator({
      load: vi.fn(async () => createConfig())
    });

    await expect(
      orchestrator.run({ cwd: "/repo", issueNumber: "42" })
    ).resolves.toEqual({
      issueNumber: 42,
      config: {
        version: 1,
        defaultAgent: "codex",
        testCommand: "pnpm test",
        dockerfilePath: ".coding-factory/Dockerfile",
        branchPrefix: "coding-factory",
        requirementsDocPath: "docs",
        imageName: "coding-factory-repo"
      }
    });
  });
});

function createConfig(): CodingFactoryConfig {
  return {
    version: 1,
    defaultAgent: "codex",
    testCommand: "pnpm test",
    dockerfilePath: ".coding-factory/Dockerfile",
    branchPrefix: "coding-factory",
    requirementsDocPath: "docs",
    imageName: "coding-factory-repo"
  };
}
