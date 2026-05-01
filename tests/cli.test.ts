import path from "node:path";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { createProgram, type CliDependencies } from "../src/cli.js";
import type { InitFileSystem, InitPrompts } from "../src/commands/init.js";
import type { CodingFactoryConfig } from "../src/lib/config.js";

const cwd = "/repo";
const configDirectory = path.join(cwd, ".coding-factory");
const configPath = path.join(configDirectory, "config.json");
const envPath = path.join(configDirectory, ".env");
const dockerfilePath = path.join(configDirectory, "Dockerfile");

describe("createProgram", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs init through injected dependencies for codex", async () => {
    const dependencies = createDependencies();
    const program = createProgram(dependencies);

    await program.parseAsync(["node", "coding-factory", "init"]);

    expect(dependencies.getCwd).toHaveBeenCalledTimes(1);
    expect(dependencies.chooseAgent).toHaveBeenCalledTimes(1);
    expect(dependencies.enterTestCommand).toHaveBeenCalledTimes(1);
    expect(dependencies.confirmOverwrite).not.toHaveBeenCalled();
    expect(dependencies.initFileSystem.access).toHaveBeenCalledWith(configDirectory);
    expect(dependencies.initFileSystem.readdir).not.toHaveBeenCalled();
    expect(dependencies.initFileSystem.mkdir).toHaveBeenCalledWith(configDirectory, { recursive: true });
    expect(dependencies.initFileSystem.writeFile).toHaveBeenCalledTimes(3);

    const envCall = dependencies.initFileSystem.writeFile.mock.calls[0];
    const configCall = dependencies.initFileSystem.writeFile.mock.calls[1];
    const dockerfileCall = dependencies.initFileSystem.writeFile.mock.calls[2];

    expect(envCall?.[0]).toBe(envPath);
    expect(envCall?.[1]).toContain("OPENAI_API_KEY=");
    expect(envCall?.[2]).toBe("utf8");
    expect(configCall?.[0]).toBe(configPath);
    expect(configCall?.[1]).toContain('"defaultAgent": "codex"');
    expect(configCall?.[1]).toContain('"testCommand": "pnpm test"');
    expect(configCall?.[2]).toBe("utf8");
    expect(dockerfileCall?.[0]).toBe(dockerfilePath);
    expect(dockerfileCall?.[1]).toContain('CMD ["codex", "--help"]');
    expect(dockerfileCall?.[2]).toBe("utf8");
    expect(dependencies.stdout.write).toHaveBeenCalledWith(`Created ${configDirectory}\n`);
    expect(dependencies.stdout.write).toHaveBeenCalledWith(
      `Update ${envPath} with your secrets before running issue orchestration.\n`
    );
    const chooseAgentCallOrder = dependencies.chooseAgent.mock.invocationCallOrder[0];
    const enterTestCommandCallOrder = dependencies.enterTestCommand.mock.invocationCallOrder[0];

    expect(chooseAgentCallOrder).toBeDefined();
    expect(enterTestCommandCallOrder).toBeDefined();
    expect(chooseAgentCallOrder!).toBeLessThan(enterTestCommandCallOrder!);
  });

  it("stops init before prompts or writes when overwrite is declined", async () => {
    const dependencies = createDependencies({
      confirmOverwrite: vi.fn<InitPrompts["confirmOverwrite"]>(async () => false),
      initFileSystem: createFileSystem({
        access: vi.fn<InitFileSystem["access"]>().mockResolvedValue(undefined),
        readdir: vi.fn<InitFileSystem["readdir"]>().mockResolvedValue(["config.json"])
      })
    });

    await createProgram(dependencies).parseAsync(["node", "coding-factory", "init"]);

    expect(dependencies.confirmOverwrite).toHaveBeenCalledWith(configDirectory);
    expect(dependencies.chooseAgent).not.toHaveBeenCalled();
    expect(dependencies.enterTestCommand).not.toHaveBeenCalled();
    expect(dependencies.initFileSystem.mkdir).not.toHaveBeenCalled();
    expect(dependencies.initFileSystem.writeFile).not.toHaveBeenCalled();
    expect(dependencies.stdout.write).toHaveBeenCalledWith("Initialization cancelled.\n");
    const readdirCallOrder = dependencies.initFileSystem.readdir.mock.invocationCallOrder[0];
    const confirmOverwriteCallOrder = dependencies.confirmOverwrite.mock.invocationCallOrder[0];

    expect(readdirCallOrder).toBeDefined();
    expect(confirmOverwriteCallOrder).toBeDefined();
    expect(readdirCallOrder!).toBeLessThan(confirmOverwriteCallOrder!);
  });

  it("surfaces init validation errors and skips writes", async () => {
    const dependencies = createDependencies({
      enterTestCommand: vi.fn<InitPrompts["enterTestCommand"]>(async () => "   ")
    });

    await expect(
      createProgram(dependencies).parseAsync(["node", "coding-factory", "init"])
    ).rejects.toThrow("Test command cannot be empty.");

    expect(dependencies.initFileSystem.mkdir).not.toHaveBeenCalled();
    expect(dependencies.initFileSystem.writeFile).not.toHaveBeenCalled();
  });

  it("runs issue through injected config reader", async () => {
    const dependencies = createDependencies({
      readConfig: vi.fn<(cwd: string) => Promise<CodingFactoryConfig | null>>(async () => createConfig())
    });

    await createProgram(dependencies).parseAsync(["node", "coding-factory", "issue", "42"]);

    expect(dependencies.readConfig).toHaveBeenCalledWith(cwd);
    expect(dependencies.stdout.write).toHaveBeenCalledWith(
      "Issue orchestration for #42 is not implemented yet. Current default agent: codex.\n"
    );
  });

  it("skips downstream issue dependencies on invalid input", async () => {
    const dependencies = createDependencies({
      readConfig: vi.fn<(cwd: string) => Promise<CodingFactoryConfig | null>>(async () => createConfig())
    });

    await expect(
      createProgram(dependencies).parseAsync(["node", "coding-factory", "issue", "0"])
    ).rejects.toThrow("Issue number must be a positive integer.");

    expect(dependencies.readConfig).not.toHaveBeenCalled();
    expect(dependencies.stdout.write).not.toHaveBeenCalled();
  });

  it("supports claude init output through injected prompts", async () => {
    const dependencies = createDependencies({
      chooseAgent: vi.fn<InitPrompts["chooseAgent"]>(async () => "claude"),
      enterTestCommand: vi.fn<InitPrompts["enterTestCommand"]>(async () => "pnpm vitest run")
    });

    await createProgram(dependencies).parseAsync(["node", "coding-factory", "init"]);

    const envCall = dependencies.initFileSystem.writeFile.mock.calls[0];
    const dockerfileCall = dependencies.initFileSystem.writeFile.mock.calls[2];

    expect(envCall?.[1]).toContain("ANTHROPIC_API_KEY=");
    expect(envCall?.[1]).not.toContain("OPENAI_API_KEY=");
    expect(dockerfileCall?.[1]).toContain('CMD ["claude", "--help"]');
  });
});

function createDependencies(overrides: Partial<TestDependencies> = {}): TestDependencies {
  return {
    chooseAgent: vi.fn<InitPrompts["chooseAgent"]>(async () => "codex"),
    confirmOverwrite: vi.fn<InitPrompts["confirmOverwrite"]>(async () => true),
    enterTestCommand: vi.fn<InitPrompts["enterTestCommand"]>(async () => "pnpm test"),
    getCwd: vi.fn<() => string>(() => cwd),
    initFileSystem: createFileSystem(),
    readConfig: vi.fn<(cwd: string) => Promise<CodingFactoryConfig | null>>(async () => createConfig()),
    stderr: {
      write: vi.fn<(chunk: string | Uint8Array) => boolean>(() => true)
    },
    stdout: {
      write: vi.fn<(chunk: string | Uint8Array) => boolean>(() => true)
    },
    ...overrides
  };
}

function createFileSystem(overrides: Partial<TestFileSystem> = {}): TestFileSystem {
  return {
    access: vi.fn<InitFileSystem["access"]>().mockRejectedValue(createEnoentError()),
    mkdir: vi.fn<InitFileSystem["mkdir"]>().mockResolvedValue(undefined),
    readdir: vi.fn<InitFileSystem["readdir"]>().mockResolvedValue([]),
    writeFile: vi.fn<InitFileSystem["writeFile"]>().mockResolvedValue(undefined),
    ...overrides
  };
}

function createConfig(): CodingFactoryConfig {
  return {
    version: 1,
    defaultAgent: "codex",
    testCommand: "pnpm test",
    dockerfilePath: ".coding-factory/Dockerfile",
    branchPrefix: "coding-factory",
    requirementsDocPath: "docs",
    imageName: "coding-factory-repo"
  };
}

function createEnoentError(): NodeJS.ErrnoException {
  return Object.assign(new Error("missing"), { code: "ENOENT" });
}

type TestDependencies = TestDependenciesBase & {
  chooseAgent: Mock<InitPrompts["chooseAgent"]>;
  confirmOverwrite: Mock<InitPrompts["confirmOverwrite"]>;
  enterTestCommand: Mock<InitPrompts["enterTestCommand"]>;
  getCwd: Mock<() => string>;
  initFileSystem: TestFileSystem;
  readConfig: Mock<(cwd: string) => Promise<CodingFactoryConfig | null>>;
};

type TestFileSystem = {
  [Key in keyof InitFileSystem]: Mock<InitFileSystem[Key]>;
};

type TestDependenciesBase = Required<Pick<CliDependencies, "stderr" | "stdout">>;
