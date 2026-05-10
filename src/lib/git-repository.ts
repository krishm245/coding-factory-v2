import {
  NodeCommandRunner,
  type CommandRunResult,
} from "./command-runner.js";

export interface GitRepositoryDependencies {
  commandRunner: Pick<NodeCommandRunner, "run">;
}

export class GitRepository {
  constructor(private readonly dependencies: GitRepositoryDependencies) {}

  async assertCleanWorkingTree(cwd: string): Promise<void> {
    const result = await this.runGit(cwd, [
      "status",
      "--porcelain",
      "--untracked-files=all",
    ]);

    this.assertGitCommandSucceeded(
      result,
      "inspect the working tree state",
    );

    if (result.stdout.trim()) {
      throw new Error(
        "Working tree is dirty. Commit, stash, or remove changes before running `coding-factory issue <number>`.",
      );
    }
  }

  async getCurrentBranchName(cwd: string): Promise<string> {
    const result = await this.runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);

    this.assertGitCommandSucceeded(result, "determine the current branch");

    const branchName = result.stdout.trim();

    if (!branchName || branchName === "HEAD") {
      throw new Error(
        "HEAD is detached. Check out a branch before running `coding-factory issue <number>`.",
      );
    }

    return branchName;
  }

  async branchExists(cwd: string, branchName: string): Promise<boolean> {
    const result = await this.runGit(cwd, [
      "show-ref",
      "--verify",
      "--quiet",
      `refs/heads/${branchName}`,
    ]);

    if (result.exitCode === 0) {
      return true;
    }

    if (result.exitCode === 1) {
      return false;
    }

    throw this.createGitCommandError(
      result,
      `check whether branch "${branchName}" exists`,
    );
  }

  async createAndCheckoutBranch(
    cwd: string,
    branchName: string,
  ): Promise<void> {
    const result = await this.runGit(cwd, ["checkout", "-b", branchName]);

    this.assertGitCommandSucceeded(
      result,
      `create and check out branch "${branchName}"`,
    );
  }

  async checkoutBranch(cwd: string, branchName: string): Promise<void> {
    const result = await this.runGit(cwd, ["checkout", branchName]);

    this.assertGitCommandSucceeded(result, `check out branch "${branchName}"`);
  }

  private async runGit(
    cwd: string,
    args: readonly string[],
  ): Promise<CommandRunResult> {
    return this.dependencies.commandRunner.run("git", args, { cwd });
  }

  private assertGitCommandSucceeded(
    result: CommandRunResult,
    action: string,
  ): void {
    if (result.exitCode !== 0) {
      throw this.createGitCommandError(result, action);
    }
  }

  private createGitCommandError(
    result: CommandRunResult,
    action: string,
  ): Error {
    const output = [result.stderr.trim(), result.stdout.trim()]
      .filter((value) => value.length > 0)
      .join(" ");

    if (output) {
      return new Error(`Failed to ${action}: ${output}`);
    }

    return new Error(`Failed to ${action}.`);
  }
}
