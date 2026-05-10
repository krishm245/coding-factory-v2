import { describe, expect, it, vi } from "vitest";
import { IssueOrchestrator } from "../src/lib/issue-orchestrator.js";
import type { CodingFactoryConfig } from "../src/lib/config.js";
import type { RepoPreparationServiceDependencies } from "../src/lib/repo-preparation-service.js";

function getConfig(
  overrides: Partial<CodingFactoryConfig> = {},
): CodingFactoryConfig {
  return {
    version: 1,
    defaultAgent: "codex",
    testCommand: "pnpm test",
    dockerfilePath: ".coding-factory/Dockerfile",
    branchPrefix: "coding-factory",
    requirementsDocPath: "docs",
    imageName: "coding-factory-repo",
    ...overrides,
  };
}

function createRepoPreparationService(): Pick<
  RepoPreparationServiceDependencies["gitRepository"],
  never
> & {
  prepareIssueBranch: ReturnType<typeof vi.fn>;
} {
  return {
    prepareIssueBranch: vi.fn(async () => ({
      branchName: "coding-factory/issue-42",
    })),
  };
}

describe("IssueOrchestrator", () => {
  it("rejects invalid issue numbers before loading config", async () => {
    const load = vi.fn(async () => null);
    const repoPreparationService = createRepoPreparationService();
    const orchestrator = new IssueOrchestrator({
      configStore: { load },
      repoPreparationService,
    });

    await expect(
      orchestrator.run({ cwd: "/repo", issueNumber: "0" }),
    ).rejects.toThrow("Issue number must be a positive integer.");
    expect(load).not.toHaveBeenCalled();
    expect(repoPreparationService.prepareIssueBranch).not.toHaveBeenCalled();
  });

  it("fails when the project is not initialized", async () => {
    const load = vi.fn(async () => null);
    const repoPreparationService = createRepoPreparationService();
    const orchestrator = new IssueOrchestrator({
      configStore: { load },
      repoPreparationService,
    });

    await expect(
      orchestrator.run({ cwd: "/repo", issueNumber: "42" }),
    ).rejects.toThrow(
      "Project is not initialized. Run `coding-factory init` first.",
    );
    expect(load).toHaveBeenCalledWith("/repo");
    expect(repoPreparationService.prepareIssueBranch).not.toHaveBeenCalled();
  });

  it("prepares the issue branch from the configured prefix and returns the context", async () => {
    const repoPreparationService = createRepoPreparationService();
    const orchestrator = new IssueOrchestrator({
      configStore: {
        load: vi.fn(async () => getConfig({ branchPrefix: "feature" })),
      },
      repoPreparationService,
    });

    await expect(
      orchestrator.run({ cwd: "/repo", issueNumber: "42" }),
    ).resolves.toEqual({
      branchName: "feature/issue-42",
      cwd: "/repo",
      issueNumber: 42,
      config: {
        version: 1,
        defaultAgent: "codex",
        testCommand: "pnpm test",
        dockerfilePath: ".coding-factory/Dockerfile",
        branchPrefix: "feature",
        requirementsDocPath: "docs",
        imageName: "coding-factory-repo",
      },
    });
    expect(repoPreparationService.prepareIssueBranch).toHaveBeenCalledWith({
      cwd: "/repo",
      branchName: "feature/issue-42",
    });
  });
});
