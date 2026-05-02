import { describe, expect, it, vi } from "vitest";
import { createProgram } from "../src/cli.js";

describe("createProgram", () => {
  it("runs the injected init command", async () => {
    const initCommand = {
      run: vi.fn(async () => undefined)
    };

    await createProgram({ initCommand }).parseAsync(["node", "coding-factory", "init"]);

    expect(initCommand.run).toHaveBeenCalledTimes(1);
  });

  it("runs the injected issue command with the issue number", async () => {
    const issueCommand = {
      run: vi.fn(async (_issueNumber: string) => undefined)
    };

    await createProgram({ issueCommand }).parseAsync([
      "node",
      "coding-factory",
      "issue",
      "42"
    ]);

    expect(issueCommand.run).toHaveBeenCalledWith("42");
  });
});
