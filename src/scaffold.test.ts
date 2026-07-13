import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTEXT_PULL_SCRIPT, CONTEXT_VALIDATE_SCRIPT } from "./constants.js";
import { scaffoldProject } from "./scaffold.js";

describe("scaffoldProject", () => {
  it("creates the complete monorepo branch", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "monorepo-template-"));
    const calls: string[] = [];
    const root = await scaffoldProject(
      {
        projectName: "example",
        mode: "monorepo",
        frontend: "vite",
        backend: "hono",
        contextSync: "standalone",
      },
      {
        cwd,
        contextRepository: "https://example.com/context-factory.git",
        run: async (command, args) => { calls.push([command, ...args].join(" ")); },
      },
    );

    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    expect(packageJson.scripts["context:pull"]).toBe(CONTEXT_PULL_SCRIPT);
    expect(packageJson.scripts["context:validate"]).toBe(CONTEXT_VALIDATE_SCRIPT);
    expect(await readFile(join(root, "pnpm-workspace.yaml"), "utf8")).toContain('"apps/*"');
    expect(await readFile(join(root, "apps/web/src/main.tsx"), "utf8")).toContain("createRoot");
    expect(await readFile(join(root, "apps/api/src/index.ts"), "utf8")).toContain("Hono");
    expect(await readFile(join(root, "packages/db/prisma/schema.prisma"), "utf8")).toContain('provider = "prisma-kysely"');
    expect(await readFile(join(root, "packages/db/prisma.config.ts"), "utf8")).toContain("defineConfig");
    expect(await readFile(join(root, "packages/tsconfig/package.json"), "utf8")).toContain("@workspace/tsconfig");
    expect(await readFile(join(root, "packages/eslint-config/package.json"), "utf8")).toContain("@workspace/eslint-config");
    expect(await readFile(join(root, ".npmrc"), "utf8")).toContain("prefer-workspace-packages=true");
    expect(await readFile(join(root, ".nvmrc"), "utf8")).toBe("20\n");
    expect(await readFile(join(root, ".github/workflows/ci.yml"), "utf8")).toContain("pnpm run build");
    expect(await readFile(join(root, ".github/workflows/deploy.yml"), "utf8")).toContain("workflow_dispatch");
    expect(await readFile(join(root, ".github/dependabot.yml"), "utf8")).toContain("package-ecosystem: github-actions");
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toContain("context-factory/orchestrator/SHARED.md");
    expect(calls).toContain("git clone https://example.com/context-factory.git context-factory");
  });

  it("creates a standard backend without workspace files", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "standard-template-"));
    const root = await scaffoldProject(
      { projectName: "api", mode: "standard", framework: "express", contextSync: "standalone" },
      { cwd, contextRepository: "https://example.com/context.git", run: async () => undefined },
    );
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    expect(packageJson.dependencies.express).toBe("latest");
    expect(packageJson.scripts["context:pull"]).toBe(CONTEXT_PULL_SCRIPT);
    expect(packageJson.scripts["context:validate"]).toBe(CONTEXT_VALIDATE_SCRIPT);
    expect(await readFile(join(root, ".npmrc"), "utf8")).toContain("engine-strict=true");
    expect(await readFile(join(root, ".nvmrc"), "utf8")).toBe("20\n");
    expect(await readFile(join(root, ".github/workflows/ci.yml"), "utf8")).toContain("node-version-file: .nvmrc");
    expect(await readFile(join(root, ".github/dependabot.yml"), "utf8")).toContain("package-ecosystem: npm");
    await expect(readFile(join(root, "pnpm-workspace.yaml"), "utf8")).rejects.toThrow();
    await expect(readFile(join(root, "turbo.json"), "utf8")).rejects.toThrow();
  });

  it("rejects path traversal and existing targets", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "guard-template-"));
    const options = { cwd, contextRepository: "https://example.com/context.git", run: async () => undefined };
    await expect(scaffoldProject(
      { projectName: "../escape", mode: "standard", framework: "express", contextSync: "standalone" },
      options,
    )).rejects.toThrow("Invalid project name");
    await scaffoldProject(
      { projectName: "same", mode: "standard", framework: "express", contextSync: "standalone" },
      options,
    );
    await expect(scaffoldProject(
      { projectName: "same", mode: "standard", framework: "express", contextSync: "standalone" },
      options,
    )).rejects.toThrow("Target already exists");
  });
});
