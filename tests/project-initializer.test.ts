import path from "node:path";
import { describe, expect, it, vi, type Mock } from "vitest";
import type { AgentName } from "../src/lib/agent-runtime.js";
import type {
  CodingFactoryConfig,
  CodingFactoryPaths,
} from "../src/lib/config.js";
import {
  ProjectInitializer,
  type ProjectInitializationFileSystem,
  type ProjectInitializerDependencies,
} from "../src/lib/project-initializer.js";

type TestFileSystem = {
  [Key in keyof ProjectInitializationFileSystem]: Mock<
    ProjectInitializationFileSystem[Key]
  >;
};

const cwd = "/repo";
const configDirectory = path.join(cwd, ".coding-factory");

function createFileSystem(
  overrides: Partial<TestFileSystem> = {},
): TestFileSystem {
  return {
    access: vi
      .fn<ProjectInitializationFileSystem["access"]>()
      .mockResolvedValue(undefined),
    mkdir: vi
      .fn<ProjectInitializationFileSystem["mkdir"]>()
      .mockResolvedValue(undefined),
    readdir: vi
      .fn<ProjectInitializationFileSystem["readdir"]>()
      .mockResolvedValue([]),
    writeFile: vi
      .fn<ProjectInitializationFileSystem["writeFile"]>()
      .mockResolvedValue(undefined),
    ...overrides,
  };
}

function createDependencies(
  overrides: Partial<ProjectInitializerDependencies> = {},
): ProjectInitializerDependencies {
  const configStore = createConfigStore();
  const agentRuntimeCatalog = createAgentRuntimeCatalog();

  return {
    agentRuntimeCatalog: overrides.agentRuntimeCatalog ?? agentRuntimeCatalog,
    configStore: overrides.configStore ?? configStore,
    fileSystem: overrides.fileSystem ?? createFileSystem(),
  };
}

function createAgentRuntimeCatalog(): ProjectInitializerDependencies["agentRuntimeCatalog"] {
  return {
    buildDockerfile: vi.fn((agentName: AgentName) =>
      agentName === "codex"
        ? 'FROM node:20\nRUN pnpm add --global @openai/codex\nCMD ["codex", "--help"]\n'
        : 'FROM node:20\nRUN pnpm add --global @anthropic-ai/claude-code\nCMD ["claude", "--help"]\n',
    ),
    buildEnvTemplate: vi.fn((agentName: AgentName) =>
      agentName === "codex"
        ? "# Fill in these values before running `coding-factory issue <number>`.\nOPENAI_API_KEY=\nGITHUB_TOKEN=\n"
        : "# Fill in these values before running `coding-factory issue <number>`.\nANTHROPIC_API_KEY=\nGITHUB_TOKEN=\n",
    ),
  };
}

function createConfigStore(): ProjectInitializerDependencies["configStore"] {
  return {
    create: vi.fn(
      (
        inputCwd: string,
        input: { defaultAgent: AgentName; testCommand: string },
      ) => createConfig(inputCwd, input.defaultAgent, input.testCommand),
    ),
    getPaths: vi.fn((inputCwd: string) => createPaths(inputCwd)),
    serialize: vi.fn(
      (config: CodingFactoryConfig) => `${JSON.stringify(config, null, 2)}\n`,
    ),
  };
}

function createPaths(inputCwd: string): CodingFactoryPaths {
  const inputConfigDirectory = path.join(inputCwd, ".coding-factory");

  return {
    configDirectory: inputConfigDirectory,
    configPath: path.join(inputConfigDirectory, "config.json"),
    envPath: path.join(inputConfigDirectory, ".env"),
    dockerfilePath: path.join(inputConfigDirectory, "Dockerfile"),
  };
}

function createConfig(
  inputCwd: string,
  defaultAgent: AgentName,
  testCommand: string,
): CodingFactoryConfig {
  return {
    version: 1,
    defaultAgent,
    testCommand,
    dockerfilePath: ".coding-factory/Dockerfile",
    branchPrefix: "coding-factory",
    requirementsDocPath: "docs",
    imageName: `coding-factory-${path.basename(inputCwd)}`,
  };
}

describe("ProjectInitializer", () => {
  it("reports that the managed directory is missing when access returns ENOENT", async () => {
    const fileSystem = createFileSystem({
      access: vi.fn(async () => {
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
      }),
    });

    await expect(
      new ProjectInitializer(createDependencies({ fileSystem })).inspect(cwd),
    ).resolves.toEqual({
      exists: false,
      paths: {
        configDirectory,
        configPath: path.join(configDirectory, "config.json"),
        envPath: path.join(configDirectory, ".env"),
        dockerfilePath: path.join(configDirectory, "Dockerfile"),
      },
    });
  });

  it("writes the managed artifacts for codex", async () => {
    const fileSystem = createFileSystem();

    const result = await new ProjectInitializer(
      createDependencies({ fileSystem }),
    ).initialize({
      cwd,
      defaultAgent: "codex",
      testCommand: "pnpm test",
    });

    expect(result.paths.configDirectory).toBe(configDirectory);
    expect(fileSystem.mkdir).toHaveBeenCalledWith(configDirectory, {
      recursive: true,
    });
    expect(fileSystem.writeFile).toHaveBeenCalledTimes(3);

    const envCall = fileSystem.writeFile.mock.calls[0];
    const configCall = fileSystem.writeFile.mock.calls[1];
    const dockerfileCall = fileSystem.writeFile.mock.calls[2];

    expect(envCall?.[0]).toBe(path.join(configDirectory, ".env"));
    expect(envCall?.[1]).toContain("OPENAI_API_KEY=");
    expect(envCall?.[1]).toContain("GITHUB_TOKEN=");
    expect(configCall?.[0]).toBe(path.join(configDirectory, "config.json"));
    expect(configCall?.[1]).toContain('"defaultAgent": "codex"');
    expect(configCall?.[1]).toContain('"testCommand": "pnpm test"');
    expect(dockerfileCall?.[0]).toBe(path.join(configDirectory, "Dockerfile"));
    expect(dockerfileCall?.[1]).toContain("pnpm add --global @openai/codex");
    expect(dockerfileCall?.[1]).toContain('CMD ["codex", "--help"]');
  });

  it("writes the claude-specific runtime artifacts", async () => {
    const fileSystem = createFileSystem();

    await new ProjectInitializer(createDependencies({ fileSystem })).initialize(
      {
        cwd,
        defaultAgent: "claude",
        testCommand: "pnpm vitest run",
      },
    );

    const envCall = fileSystem.writeFile.mock.calls[0];
    const dockerfileCall = fileSystem.writeFile.mock.calls[2];

    expect(envCall?.[1]).toContain("ANTHROPIC_API_KEY=");
    expect(envCall?.[1]).not.toContain("OPENAI_API_KEY=");
    expect(dockerfileCall?.[1]).toContain(
      "pnpm add --global @anthropic-ai/claude-code",
    );
    expect(dockerfileCall?.[1]).toContain('CMD ["claude", "--help"]');
  });
});
