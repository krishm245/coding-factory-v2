import path from "node:path";
import { describe, expect, it, vi, type Mock } from "vitest";
import {
  ProjectInitializer,
  type ProjectInitializationFileSystem
} from "../src/lib/project-initializer.js";

const cwd = "/repo";
const configDirectory = path.join(cwd, ".coding-factory");

describe("ProjectInitializer", () => {
  it("reports that the managed directory is missing when access returns ENOENT", async () => {
    const fileSystem = createFileSystem({
      access: vi.fn(async () => {
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
      })
    });

    await expect(new ProjectInitializer(fileSystem).inspect(cwd)).resolves.toEqual({
      exists: false,
      paths: {
        configDirectory,
        configPath: path.join(configDirectory, "config.json"),
        envPath: path.join(configDirectory, ".env"),
        dockerfilePath: path.join(configDirectory, "Dockerfile")
      }
    });
  });

  it("writes the managed artifacts for codex", async () => {
    const fileSystem = createFileSystem();

    const result = await new ProjectInitializer(fileSystem).initialize({
      cwd,
      defaultAgent: "codex",
      testCommand: "pnpm test"
    });

    expect(result.paths.configDirectory).toBe(configDirectory);
    expect(fileSystem.mkdir).toHaveBeenCalledWith(configDirectory, { recursive: true });
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

    await new ProjectInitializer(fileSystem).initialize({
      cwd,
      defaultAgent: "claude",
      testCommand: "pnpm vitest run"
    });

    const envCall = fileSystem.writeFile.mock.calls[0];
    const dockerfileCall = fileSystem.writeFile.mock.calls[2];

    expect(envCall?.[1]).toContain("ANTHROPIC_API_KEY=");
    expect(envCall?.[1]).not.toContain("OPENAI_API_KEY=");
    expect(dockerfileCall?.[1]).toContain("pnpm add --global @anthropic-ai/claude-code");
    expect(dockerfileCall?.[1]).toContain('CMD ["claude", "--help"]');
  });
});

function createFileSystem(
  overrides: Partial<TestFileSystem> = {}
): TestFileSystem {
  return {
    access: vi.fn<ProjectInitializationFileSystem["access"]>().mockResolvedValue(undefined),
    mkdir: vi.fn<ProjectInitializationFileSystem["mkdir"]>().mockResolvedValue(undefined),
    readdir: vi.fn<ProjectInitializationFileSystem["readdir"]>().mockResolvedValue([]),
    writeFile: vi
      .fn<ProjectInitializationFileSystem["writeFile"]>()
      .mockResolvedValue(undefined),
    ...overrides
  };
}

type TestFileSystem = {
  [Key in keyof ProjectInitializationFileSystem]: Mock<ProjectInitializationFileSystem[Key]>;
};
