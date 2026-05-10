import { describe, expect, it, vi, type Mock } from "vitest";
import type { CommandRunResult } from "../src/lib/command-runner.js";
import {
  GitRepository,
  type GitRepositoryDependencies,
} from "../src/lib/git-repository.js";

type TestCommandRunner = {
  run: Mock<GitRepositoryDependencies["commandRunner"]["run"]>;
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
      .fn<GitRepositoryDependencies["commandRunner"]["run"]>()
      .mockImplementation(async () => {
        const nextResult = results.shift();

        if (!nextResult) {
          throw new Error("Unexpected command execution.");
        }

        return nextResult;
      }),
  };
}

describe("GitRepository", () => {
  it("accepts a clean working tree", async () => {
    const commandRunner = createCommandRunner([createResult()]);
    const repository = new GitRepository({ commandRunner });

    await expect(
      repository.assertCleanWorkingTree("/repo"),
    ).resolves.toBeUndefined();

    expect(commandRunner.run).toHaveBeenCalledWith(
      "git",
      ["status", "--porcelain", "--untracked-files=all"],
      { cwd: "/repo" },
    );
  });

  it("rejects a dirty working tree", async () => {
    const commandRunner = createCommandRunner([
      createResult({ stdout: " M src/cli.ts\n" }),
    ]);
    const repository = new GitRepository({ commandRunner });

    await expect(repository.assertCleanWorkingTree("/repo")).rejects.toThrow(
      "Working tree is dirty. Commit, stash, or remove changes before running `coding-factory issue <number>`.",
    );
  });

  it("rejects detached HEAD states", async () => {
    const commandRunner = createCommandRunner([
      createResult({ stdout: "HEAD\n" }),
    ]);
    const repository = new GitRepository({ commandRunner });

    await expect(repository.getCurrentBranchName("/repo")).rejects.toThrow(
      "HEAD is detached. Check out a branch before running `coding-factory issue <number>`.",
    );
  });

  it("interprets local branch existence from git exit codes", async () => {
    const commandRunner = createCommandRunner([
      createResult({ exitCode: 0 }),
      createResult({ exitCode: 1 }),
    ]);
    const repository = new GitRepository({ commandRunner });

    await expect(
      repository.branchExists("/repo", "coding-factory/issue-42"),
    ).resolves.toBe(true);
    await expect(
      repository.branchExists("/repo", "coding-factory/issue-43"),
    ).resolves.toBe(false);
  });

  it("uses checkout commands for branch creation and reuse", async () => {
    const commandRunner = createCommandRunner([createResult(), createResult()]);
    const repository = new GitRepository({ commandRunner });

    await repository.createAndCheckoutBranch("/repo", "coding-factory/issue-42");
    await repository.checkoutBranch("/repo", "coding-factory/issue-42");

    expect(commandRunner.run).toHaveBeenNthCalledWith(
      1,
      "git",
      ["checkout", "-b", "coding-factory/issue-42"],
      { cwd: "/repo" },
    );
    expect(commandRunner.run).toHaveBeenNthCalledWith(
      2,
      "git",
      ["checkout", "coding-factory/issue-42"],
      { cwd: "/repo" },
    );
  });
});
