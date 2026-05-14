import type {
  DockerWorkerCommandRequest,
  DockerWorkerHandle,
  DockerWorkerService,
} from "./docker-worker-service.js";

export interface GitHubIssue {
  body: string;
  number: number;
  title: string;
}

export interface GitHubIssueFetchRequest {
  issueNumber: number;
  worker: DockerWorkerHandle;
}

export interface GitHubIssueServiceDependencies {
  dockerWorkerService: Pick<DockerWorkerService, "runCommandInWorker">;
}

export class GitHubIssueService {
  constructor(private readonly dependencies: GitHubIssueServiceDependencies) {}

  async fetchIssue(request: GitHubIssueFetchRequest): Promise<GitHubIssue> {
    await this.assertGitHubToken(request.worker);

    const result =
      await this.dependencies.dockerWorkerService.runCommandInWorker(
        request.worker,
        {
          args: [
            "issue",
            "view",
            String(request.issueNumber),
            "--json",
            "title,body",
          ],
          command: "gh",
        },
      );

    if (result.exitCode !== 0) {
      throw new Error(
        this.buildCommandFailureMessage(
          request.issueNumber,
          "fetch GitHub issue",
          result.stderr,
          result.stdout,
        ),
      );
    }

    return this.parseIssue(result.stdout, request.issueNumber);
  }

  private async assertGitHubToken(worker: DockerWorkerHandle): Promise<void> {
    const command: DockerWorkerCommandRequest = {
      args: ["GITHUB_TOKEN"],
      command: "printenv",
    };
    const result =
      await this.dependencies.dockerWorkerService.runCommandInWorker(
        worker,
        command,
      );

    if (result.exitCode !== 0 || result.stdout.trim().length === 0) {
      throw new Error(
        "Missing GitHub token. Set GITHUB_TOKEN in .coding-factory/.env before running `coding-factory issue <number>`.",
      );
    }
  }

  private parseIssue(rawIssue: string, issueNumber: number): GitHubIssue {
    let parsedIssue: unknown;

    try {
      parsedIssue = JSON.parse(rawIssue);
    } catch {
      throw new Error(
        `Failed to parse GitHub issue #${issueNumber}: expected valid JSON output from gh.`,
      );
    }

    if (!this.isGitHubIssueResponse(parsedIssue)) {
      throw new Error(
        `Failed to parse GitHub issue #${issueNumber}: expected string title and body fields.`,
      );
    }

    if (parsedIssue.title.trim().length === 0) {
      throw new Error(`GitHub issue #${issueNumber} is missing a title.`);
    }

    if (parsedIssue.body.trim().length === 0) {
      throw new Error(`GitHub issue #${issueNumber} is missing a body.`);
    }

    return {
      body: parsedIssue.body,
      number: issueNumber,
      title: parsedIssue.title,
    };
  }

  private buildCommandFailureMessage(
    issueNumber: number,
    action: string,
    stderr: string,
    stdout: string,
  ): string {
    const output = [stderr.trim(), stdout.trim()]
      .filter((value) => value.length > 0)
      .join(" ");

    if (output.length > 0) {
      return `Failed to ${action} #${issueNumber}: ${output}`;
    }

    return `Failed to ${action} #${issueNumber}.`;
  }

  private isGitHubIssueResponse(
    value: unknown,
  ): value is { body: string; title: string } {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }

    const issue = value as Record<string, unknown>;

    return typeof issue.body === "string" && typeof issue.title === "string";
  }
}
