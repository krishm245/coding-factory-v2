import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { InitCommand, type InitPrompts } from "../src/commands/init.js";
import type {
  ProjectInitializationInspection,
  ProjectInitializationResult,
} from "../src/lib/project-initializer.js";

function createDependencies(
  overrides: Partial<{
    chooseAgent: ReturnType<typeof vi.fn<InitPrompts["chooseAgent"]>>;
    confirmOverwrite: ReturnType<typeof vi.fn<InitPrompts["confirmOverwrite"]>>;
    enterTestCommand: ReturnType<typeof vi.fn<InitPrompts["enterTestCommand"]>>;
    initialize: ReturnType<typeof vi.fn>;
    inspection: ProjectInitializationInspection;
  }> = {},
): ConstructorParameters<typeof InitCommand>[0] {
  const chooseAgent =
    overrides.chooseAgent ??
    vi.fn<InitPrompts["chooseAgent"]>(async () => "codex");
  const confirmOverwrite =
    overrides.confirmOverwrite ??
    vi.fn<InitPrompts["confirmOverwrite"]>(async () => true);
  const enterTestCommand =
    overrides.enterTestCommand ??
    vi.fn<InitPrompts["enterTestCommand"]>(async () => "pnpm test");
  const initialize =
    overrides.initialize ??
    vi.fn(async () => ({ paths }) satisfies ProjectInitializationResult);
  const inspection = overrides.inspection ?? { exists: false, paths };
  const inspect = vi.fn(async () => inspection);
  const stdout = {
    write: vi.fn<(chunk: string | Uint8Array) => boolean>(() => true),
  };

  return {
    getCwd: () => cwd,
    projectInitializer: {
      initialize,
      inspect,
    },
    prompts: {
      chooseAgent,
      confirmOverwrite,
      enterTestCommand,
    },
    stdout,
  };
}

const cwd = "/repo";
const paths = {
  configDirectory: path.join(cwd, ".coding-factory"),
  configPath: path.join(cwd, ".coding-factory", "config.json"),
  envPath: path.join(cwd, ".coding-factory", ".env"),
  dockerfilePath: path.join(cwd, ".coding-factory", "Dockerfile"),
};

describe("InitCommand", () => {
  it("initializes the project through the project initialization seam", async () => {
    const dependencies = createDependencies();

    await new InitCommand(dependencies).run();

    expect(dependencies.projectInitializer.inspect).toHaveBeenCalledWith(cwd);
    expect(dependencies.prompts.confirmOverwrite).not.toHaveBeenCalled();
    expect(dependencies.prompts.chooseAgent).toHaveBeenCalledTimes(1);
    expect(dependencies.prompts.enterTestCommand).toHaveBeenCalledTimes(1);
    expect(dependencies.projectInitializer.initialize).toHaveBeenCalledWith({
      cwd,
      defaultAgent: "codex",
      testCommand: "pnpm test",
    });
    expect(dependencies.stdout.write).toHaveBeenCalledWith(
      `Created ${paths.configDirectory}\n`,
    );
    expect(dependencies.stdout.write).toHaveBeenCalledWith(
      `Update ${paths.envPath} with your secrets before running issue orchestration.\n`,
    );
  });

  it("cancels initialization when overwrite is declined", async () => {
    const dependencies = createDependencies({
      confirmOverwrite: vi.fn(async () => false),
      inspection: { exists: true, paths },
    });

    await new InitCommand(dependencies).run();

    expect(dependencies.prompts.confirmOverwrite).toHaveBeenCalledWith(
      paths.configDirectory,
    );
    expect(dependencies.prompts.chooseAgent).not.toHaveBeenCalled();
    expect(dependencies.prompts.enterTestCommand).not.toHaveBeenCalled();
    expect(dependencies.projectInitializer.initialize).not.toHaveBeenCalled();
    expect(dependencies.stdout.write).toHaveBeenCalledWith(
      "Initialization cancelled.\n",
    );
  });

  it("surfaces validation errors from project initialization", async () => {
    const dependencies = createDependencies({
      enterTestCommand: vi.fn(async () => "   "),
      initialize: vi.fn(async () => {
        throw new Error("Test command cannot be empty.");
      }),
    });

    await expect(new InitCommand(dependencies).run()).rejects.toThrow(
      "Test command cannot be empty.",
    );
    expect(dependencies.stdout.write).not.toHaveBeenCalled();
  });
});
