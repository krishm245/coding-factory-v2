import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeProject } from "../src/commands/init.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.map(async (directory) => rm(directory, { recursive: true, force: true }))
  );
  tempDirectories.length = 0;
});

describe("initializeProject", () => {
  it("creates config, env, and dockerfile for codex", async () => {
    const cwd = await createTempDirectory();
    const writes: string[] = [];

    await initializeProject({
      cwd,
      prompts: {
        chooseAgent: async () => "codex",
        enterTestCommand: async () => "pnpm test",
        confirmOverwrite: async () => true
      },
      stdout: {
        write: (chunk) => {
          writes.push(String(chunk));
          return true;
        }
      }
    });

    const config = await readFile(path.join(cwd, ".coding-factory", "config.json"), "utf8");
    const envFile = await readFile(path.join(cwd, ".coding-factory", ".env"), "utf8");
    const dockerfile = await readFile(path.join(cwd, ".coding-factory", "Dockerfile"), "utf8");

    expect(config).toContain('"defaultAgent": "codex"');
    expect(config).toContain('"testCommand": "pnpm test"');
    expect(envFile).toContain("OPENAI_API_KEY=");
    expect(envFile).toContain("GITHUB_TOKEN=");
    expect(dockerfile).toContain("npm install -g @openai/codex");
    expect(dockerfile).not.toContain("@anthropic-ai/claude-code");
    expect(writes.join("")).toContain("Created");
  });

  it("creates a claude-specific env file and dockerfile", async () => {
    const cwd = await createTempDirectory();

    await initializeProject({
      cwd,
      prompts: {
        chooseAgent: async () => "claude",
        enterTestCommand: async () => "pnpm vitest run",
        confirmOverwrite: async () => true
      },
      stdout: silentWriter()
    });

    const envFile = await readFile(path.join(cwd, ".coding-factory", ".env"), "utf8");
    const dockerfile = await readFile(path.join(cwd, ".coding-factory", "Dockerfile"), "utf8");

    expect(envFile).toContain("ANTHROPIC_API_KEY=");
    expect(envFile).not.toContain("OPENAI_API_KEY=");
    expect(dockerfile).toContain("npm install -g @anthropic-ai/claude-code");
    expect(dockerfile).not.toContain("@openai/codex");
  });

  it("leaves existing files untouched when overwrite is declined", async () => {
    const cwd = await createTempDirectory();
    const configDirectory = path.join(cwd, ".coding-factory");

    await mkdir(configDirectory, { recursive: true });
    await writeFile(path.join(configDirectory, "config.json"), '{"version":1,"defaultAgent":"codex"}\n', "utf8");

    await initializeProject({
      cwd,
      prompts: {
        chooseAgent: async () => "claude",
        enterTestCommand: async () => "pnpm test",
        confirmOverwrite: async () => false
      },
      stdout: silentWriter()
    });

    const config = await readFile(path.join(configDirectory, "config.json"), "utf8");
    expect(config).toBe('{"version":1,"defaultAgent":"codex"}\n');
  });
});

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "coding-factory-"));
  tempDirectories.push(directory);
  return directory;
}

function silentWriter(): { write: (chunk: string | Uint8Array) => boolean } {
  return {
    write: () => true
  };
}
