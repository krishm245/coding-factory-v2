import { describe, expect, it, vi, type Mock } from "vitest";
import {
  RepoPreparationService,
  type RepoPreparationServiceDependencies,
} from "../src/lib/repo-preparation-service.js";

type TestGitRepository = {
  [Key in keyof RepoPreparationServiceDependencies["gitRepository"]]: Mock<
    RepoPreparationServiceDependencies["gitRepository"][Key]
  >;
};

function createGitRepository(
  overrides: Partial<TestGitRepository> = {},
): TestGitRepository {
  return {
    assertCleanWorkingTree: vi
      .fn<
        RepoPreparationServiceDependencies["gitRepository"]["assertCleanWorkingTree"]
      >()
      .mockResolvedValue(undefined),
    branchExists: vi
      .fn<RepoPreparationServiceDependencies["gitRepository"]["branchExists"]>()
      .mockResolvedValue(false),
    checkoutBranch: vi
      .fn<RepoPreparationServiceDependencies["gitRepository"]["checkoutBranch"]>()
      .mockResolvedValue(undefined),
    createAndCheckoutBranch: vi
      .fn<
        RepoPreparationServiceDependencies["gitRepository"]["createAndCheckoutBranch"]
      >()
      .mockResolvedValue(undefined),
    getCurrentBranchName: vi
      .fn<
        RepoPreparationServiceDependencies["gitRepository"]["getCurrentBranchName"]
      >()
      .mockResolvedValue("main"),
    ...overrides,
  };
}

describe("RepoPreparationService", () => {
  it("skips branch work when the repo is dirty", async () => {
    const gitRepository = createGitRepository({
      assertCleanWorkingTree: vi.fn(async () => {
        throw new Error("Working tree is dirty.");
      }),
    });
    const service = new RepoPreparationService({ gitRepository });

    await expect(
      service.prepareIssueBranch({
        cwd: "/repo",
        branchName: "coding-factory/issue-42",
      }),
    ).rejects.toThrow("Working tree is dirty.");

    expect(gitRepository.getCurrentBranchName).not.toHaveBeenCalled();
    expect(gitRepository.branchExists).not.toHaveBeenCalled();
    expect(gitRepository.checkoutBranch).not.toHaveBeenCalled();
    expect(gitRepository.createAndCheckoutBranch).not.toHaveBeenCalled();
  });

  it("treats the current target branch as a no-op", async () => {
    const gitRepository = createGitRepository({
      getCurrentBranchName: vi
        .fn<
          RepoPreparationServiceDependencies["gitRepository"]["getCurrentBranchName"]
        >()
        .mockResolvedValue("coding-factory/issue-42"),
    });
    const service = new RepoPreparationService({ gitRepository });

    await expect(
      service.prepareIssueBranch({
        cwd: "/repo",
        branchName: "coding-factory/issue-42",
      }),
    ).resolves.toEqual({
      branchName: "coding-factory/issue-42",
    });

    expect(gitRepository.branchExists).not.toHaveBeenCalled();
    expect(gitRepository.checkoutBranch).not.toHaveBeenCalled();
    expect(gitRepository.createAndCheckoutBranch).not.toHaveBeenCalled();
  });

  it("checks out an existing target branch when it is not current", async () => {
    const gitRepository = createGitRepository({
      branchExists: vi
        .fn<RepoPreparationServiceDependencies["gitRepository"]["branchExists"]>()
        .mockResolvedValue(true),
    });
    const service = new RepoPreparationService({ gitRepository });

    await expect(
      service.prepareIssueBranch({
        cwd: "/repo",
        branchName: "coding-factory/issue-42",
      }),
    ).resolves.toEqual({
      branchName: "coding-factory/issue-42",
    });

    expect(gitRepository.branchExists).toHaveBeenCalledWith(
      "/repo",
      "coding-factory/issue-42",
    );
    expect(gitRepository.checkoutBranch).toHaveBeenCalledWith(
      "/repo",
      "coding-factory/issue-42",
    );
    expect(gitRepository.createAndCheckoutBranch).not.toHaveBeenCalled();
  });

  it("creates the target branch when it does not exist", async () => {
    const gitRepository = createGitRepository();
    const service = new RepoPreparationService({ gitRepository });

    await expect(
      service.prepareIssueBranch({
        cwd: "/repo",
        branchName: "coding-factory/issue-42",
      }),
    ).resolves.toEqual({
      branchName: "coding-factory/issue-42",
    });

    expect(gitRepository.branchExists).toHaveBeenCalledWith(
      "/repo",
      "coding-factory/issue-42",
    );
    expect(gitRepository.createAndCheckoutBranch).toHaveBeenCalledWith(
      "/repo",
      "coding-factory/issue-42",
    );
    expect(gitRepository.checkoutBranch).not.toHaveBeenCalled();
  });
});
