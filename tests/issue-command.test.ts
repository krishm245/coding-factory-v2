import { describe, expect, it, vi } from "vitest";
import {
  IssueCommand,
  type IssueCommandDependencies,
} from "../src/commands/issue.js";
import type { CodingFactoryConfig } from "../src/lib/config.js";
import type { IssueOrchestrationContext } from "../src/lib/issue-orchestrator.js";

function getIssueOrchestrationContext(): IssueOrchestrationContext {
  return {
    cwd: "/repo",
    issueNumber: 42,
    config: getConfig(),
  };
}

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

function createDependencies(
  overrides: Partial<IssueCommandDependencies> = {},
): IssueCommandDependencies {
  return {
    getCwd: overrides.getCwd ?? (() => "/repo"),
    issueOrchestrator: overrides.issueOrchestrator ?? {
      run: vi.fn(async () => getIssueOrchestrationContext()),
    },
  };
}

describe("IssueCommand", () => {
  it("delegates the issue run to the orchestration seam", async () => {
    const dependencies = createDependencies();

    await new IssueCommand(dependencies).run("42");

    expect(dependencies.issueOrchestrator.run).toHaveBeenCalledWith({
      cwd: "/repo",
      issueNumber: "42",
    });
  });

  it("surfaces orchestration failures unchanged", async () => {
    const dependencies = createDependencies({
      issueOrchestrator: {
        run: vi.fn(async () => {
          throw new Error(
            "Project is not initialized. Run `coding-factory init` first.",
          );
        }),
      },
    });

    await expect(new IssueCommand(dependencies).run("42")).rejects.toThrow(
      "Project is not initialized. Run `coding-factory init` first.",
    );
  });
});
