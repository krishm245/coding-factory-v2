import { describe, expect, it, vi } from "vitest";
import type { DockerWorkerHandle } from "../src/lib/docker-worker-service.js";
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

function getDockerWorkerHandle(): DockerWorkerHandle {
  return {
    containerName: "coding-factory-repo-issue-42",
    cwd: "/repo",
    imageName: "coding-factory-repo",
    workspacePath: "/workspace",
  };
}

describe("IssueOrchestrator", () => {
  it("rejects invalid issue numbers before loading config", async () => {
    const load = vi.fn(async () => null);
    const repoPreparationService = createRepoPreparationService();
    const orchestrator = new IssueOrchestrator({
      configStore: { load },
      dockerWorkerService: {
        cleanupWorker: vi.fn(async () => undefined),
        startWorker: vi.fn(async () => getDockerWorkerHandle()),
      },
      issueWorkflowRunner: {
        run: vi.fn(async () => undefined),
      },
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
      dockerWorkerService: {
        cleanupWorker: vi.fn(async () => undefined),
        startWorker: vi.fn(async () => getDockerWorkerHandle()),
      },
      issueWorkflowRunner: {
        run: vi.fn(async () => undefined),
      },
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
    const worker = getDockerWorkerHandle();
    const startWorker = vi.fn(async (request) => {
      return worker;
    });
    const cleanupWorker = vi.fn(async () => undefined);
    const workflowCalls: string[] = [];
    const orchestrator = new IssueOrchestrator({
      configStore: {
        load: vi.fn(async () => getConfig({ branchPrefix: "feature" })),
      },
      dockerWorkerService: {
        cleanupWorker,
        startWorker: vi.fn(async (request) => {
          workflowCalls.push(`start:${request.imageName}`);
          return startWorker(request);
        }),
      },
      issueWorkflowRunner: {
        run: vi.fn(async () => {
          workflowCalls.push("workflow");
        }),
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
    expect(startWorker).toHaveBeenCalledWith({
      cwd: "/repo",
      dockerfilePath: ".coding-factory/Dockerfile",
      imageName: "coding-factory-repo",
      issueNumber: 42,
    });
    expect(cleanupWorker).toHaveBeenCalledWith(worker);
    expect(workflowCalls).toEqual(["start:coding-factory-repo", "workflow"]);
  });

  it("cleans up the worker when the workflow fails after startup", async () => {
    const repoPreparationService = createRepoPreparationService();
    const worker = getDockerWorkerHandle();
    const cleanupWorker = vi.fn(async () => undefined);
    const workflowError = new Error("Workflow failed.");
    const orchestrator = new IssueOrchestrator({
      configStore: {
        load: vi.fn(async () => getConfig()),
      },
      dockerWorkerService: {
        cleanupWorker,
        startWorker: vi.fn(async () => worker),
      },
      issueWorkflowRunner: {
        run: vi.fn(async () => {
          throw workflowError;
        }),
      },
      repoPreparationService,
    });

    await expect(
      orchestrator.run({ cwd: "/repo", issueNumber: "42" }),
    ).rejects.toThrow("Workflow failed.");

    expect(cleanupWorker).toHaveBeenCalledWith(worker);
  });

  it("preserves the workflow failure when cleanup also fails", async () => {
    const repoPreparationService = createRepoPreparationService();
    const worker = getDockerWorkerHandle();
    const orchestrator = new IssueOrchestrator({
      configStore: {
        load: vi.fn(async () => getConfig()),
      },
      dockerWorkerService: {
        cleanupWorker: vi.fn(async () => {
          throw new Error("Failed to stop Docker worker.");
        }),
        startWorker: vi.fn(async () => worker),
      },
      issueWorkflowRunner: {
        run: vi.fn(async () => {
          throw new Error("Workflow failed.");
        }),
      },
      repoPreparationService,
    });

    await expect(
      orchestrator.run({ cwd: "/repo", issueNumber: "42" }),
    ).rejects.toThrow(
      "Workflow failed. Cleanup also failed: Failed to stop Docker worker.",
    );
  });
});
