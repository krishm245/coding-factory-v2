import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CodingFactoryConfigStore,
  InvalidCodingFactoryConfigError
} from "../src/lib/config.js";

describe("CodingFactoryConfigStore", () => {
  it("returns null when the config file is missing", async () => {
    const store = new CodingFactoryConfigStore({
      readFile: vi.fn(async () => {
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
      })
    });

    await expect(store.load("/repo")).resolves.toBeNull();
  });

  it("fails hard when the config file is invalid json", async () => {
    const store = new CodingFactoryConfigStore({
      readFile: vi.fn(async () => "{")
    });

    await expect(store.load("/repo")).rejects.toEqual(
      new InvalidCodingFactoryConfigError(
        path.join("/repo", ".coding-factory", "config.json"),
        "File is not valid JSON."
      )
    );
  });

  it("fails hard when the config file shape is invalid", async () => {
    const store = new CodingFactoryConfigStore({
      readFile: vi.fn(
        async () =>
          JSON.stringify({
            version: 1,
            defaultAgent: "unknown",
            testCommand: "pnpm test",
            dockerfilePath: ".coding-factory/Dockerfile",
            branchPrefix: "coding-factory",
            requirementsDocPath: "docs",
            imageName: "coding-factory-repo"
          })
      )
    });

    await expect(store.load("/repo")).rejects.toEqual(
      new InvalidCodingFactoryConfigError(
        path.join("/repo", ".coding-factory", "config.json"),
        'Expected "defaultAgent" to be "codex" or "claude".'
      )
    );
  });

  it("loads a valid config file", async () => {
    const store = new CodingFactoryConfigStore({
      readFile: vi.fn(
        async () =>
          JSON.stringify({
            version: 1,
            defaultAgent: "codex",
            testCommand: "pnpm test",
            dockerfilePath: ".coding-factory/Dockerfile",
            branchPrefix: "coding-factory",
            requirementsDocPath: "docs",
            imageName: "coding-factory-repo"
          })
      )
    });

    await expect(store.load("/repo")).resolves.toEqual({
      version: 1,
      defaultAgent: "codex",
      testCommand: "pnpm test",
      dockerfilePath: ".coding-factory/Dockerfile",
      branchPrefix: "coding-factory",
      requirementsDocPath: "docs",
      imageName: "coding-factory-repo"
    });
  });
});
