import { GitRepository } from "./git-repository.js";

export interface RepoPreparationRequest {
  branchName: string;
  cwd: string;
}

export interface RepoPreparationResult {
  branchName: string;
}

export interface RepoPreparationServiceDependencies {
  gitRepository: Pick<
    GitRepository,
    | "assertCleanWorkingTree"
    | "branchExists"
    | "checkoutBranch"
    | "createAndCheckoutBranch"
    | "getCurrentBranchName"
  >;
}

export class RepoPreparationService {
  constructor(
    private readonly dependencies: RepoPreparationServiceDependencies,
  ) {}

  async prepareIssueBranch(
    request: RepoPreparationRequest,
  ): Promise<RepoPreparationResult> {
    await this.dependencies.gitRepository.assertCleanWorkingTree(request.cwd);

    const currentBranchName =
      await this.dependencies.gitRepository.getCurrentBranchName(request.cwd);

    if (currentBranchName === request.branchName) {
      return { branchName: request.branchName };
    }

    const branchExists = await this.dependencies.gitRepository.branchExists(
      request.cwd,
      request.branchName,
    );

    if (branchExists) {
      await this.dependencies.gitRepository.checkoutBranch(
        request.cwd,
        request.branchName,
      );
    } else {
      await this.dependencies.gitRepository.createAndCheckoutBranch(
        request.cwd,
        request.branchName,
      );
    }

    return { branchName: request.branchName };
  }
}
