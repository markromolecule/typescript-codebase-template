import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTEXT_VALIDATE_SCRIPT, getContextPullScript } from "./constants.js";
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
        contextSync: "bundled",
      },
      {
        cwd,
        run: async (command, args) => { calls.push([command, ...args].join(" ")); },
      },
    );

    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    expect(packageJson.scripts["context:pull"]).toBe(getContextPullScript("bundled"));
    expect(packageJson.scripts["context:validate"]).toBe(CONTEXT_VALIDATE_SCRIPT);
    expect(await readFile(join(root, "pnpm-workspace.yaml"), "utf8")).toContain('"apps/*"');
    expect(await readFile(join(root, "apps/web/src/main.tsx"), "utf8")).toContain("createRoot");
    expect(await readFile(join(root, "apps/api/src/index.ts"), "utf8")).toContain("Hono");
    expect(await readFile(join(root, "apps/api/src/index.ts"), "utf8")).toContain(
      'app.route("/samples", createSampleRoutes(sampleStore))',
    );
    expect(await readFile(join(root, "apps/api/src/index.ts"), "utf8")).toContain("bodyLimit({ maxSize: 100 * 1024");
    expect(JSON.parse(await readFile(join(root, "apps/api/tsconfig.json"), "utf8")).compilerOptions.types).toEqual(["node"]);
    expect(JSON.parse(await readFile(join(root, "apps/api/package.json"), "utf8")).dependencies.zod).toBe("latest");
    for (const layer of ["services", "controllers", "data"]) {
      for (const action of ["create", "update", "delete"]) {
        const suffix = layer === "services" ? "service" : layer === "controllers" ? "controller" : "data";
        expect(await readFile(
          join(root, `apps/api/src/modules/sample/${layer}/${action}-sample.${suffix}.ts`),
          "utf8",
        )).toContain(`${action}Sample`);
      }
    }
    expect(await readFile(join(root, "apps/api/src/modules/sample/dto/sample.dto.ts"), "utf8")).toContain(".strict()");
    expect(await readFile(join(root, "apps/api/src/modules/sample/sample.routes.ts"), "utf8")).toContain('patch("/:id"');
    expect(await readFile(join(root, "packages/db/prisma/schema.prisma"), "utf8")).toContain('provider = "prisma-kysely"');
    expect(await readFile(join(root, "packages/db/prisma.config.ts"), "utf8")).toContain("defineConfig");
    const databasePackage = JSON.parse(await readFile(join(root, "packages/db/package.json"), "utf8"));
    expect(databasePackage.devDependencies["@types/node"]).toBe("latest");
    expect(JSON.parse(await readFile(join(root, "packages/db/tsconfig.json"), "utf8")).compilerOptions.types).toEqual(["node"]);
    expect(await readFile(join(root, "packages/tsconfig/package.json"), "utf8")).toContain("@workspace/tsconfig");
    expect(await readFile(join(root, "packages/eslint-config/package.json"), "utf8")).toContain("@workspace/eslint-config");
    for (const directory of ["schemas", "types", "utils", "constants"]) {
      expect(await readFile(join(root, `packages/shared/src/${directory}/index.ts`), "utf8")).toBe("export {};\n");
    }
    expect(await readFile(join(root, "packages/shared/src/index.ts"), "utf8")).toContain(
      'export * from "./schemas/index.js";',
    );
    expect(await readFile(join(root, ".npmrc"), "utf8")).toContain("prefer-workspace-packages=true");
    expect(await readFile(join(root, ".nvmrc"), "utf8")).toBe("20\n");
    expect(await readFile(join(root, ".github/workflows/ci.yml"), "utf8")).toContain("pnpm run build");
    expect(await readFile(join(root, ".github/workflows/deploy.yml"), "utf8")).toContain("workflow_dispatch");
    expect(await readFile(join(root, ".github/dependabot.yml"), "utf8")).toContain("package-ecosystem: github-actions");
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toContain("context-factory/orchestrator/SHARED.md");
    expect(await readFile(join(root, "context-factory/context-manifest.json"), "utf8")).toContain('"contextVersion": "2.3.0"');
    expect(calls).toEqual([]);
  });

  it("creates a standard backend without workspace files", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "standard-template-"));
    const root = await scaffoldProject(
      { projectName: "api", mode: "standard", framework: "express", contextSync: "bundled" },
      { cwd, run: async () => undefined },
    );
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    expect(packageJson.dependencies.express).toBe("latest");
    expect(packageJson.dependencies.zod).toBe("latest");
    expect(JSON.parse(await readFile(join(root, "tsconfig.json"), "utf8")).compilerOptions.types).toEqual(["node"]);
    expect(packageJson.scripts["context:pull"]).toBe(getContextPullScript("bundled"));
    expect(packageJson.scripts["context:validate"]).toBe(CONTEXT_VALIDATE_SCRIPT);
    expect(await readFile(join(root, ".npmrc"), "utf8")).toContain("engine-strict=true");
    expect(await readFile(join(root, ".nvmrc"), "utf8")).toBe("20\n");
    expect(await readFile(join(root, ".github/workflows/ci.yml"), "utf8")).toContain("node-version-file: .nvmrc");
    expect(await readFile(join(root, ".github/dependabot.yml"), "utf8")).toContain("package-ecosystem: npm");
    expect(await readFile(join(root, "src/index.ts"), "utf8")).toContain(
      'app.use("/samples", createSampleRoutes(sampleStore))',
    );
    expect(await readFile(join(root, "src/index.ts"), "utf8")).toContain('express.json({ limit: "100kb" })');
    expect(await readFile(join(root, "src/modules/sample/controllers/create-sample.controller.ts"), "utf8")).toContain(
      "createSampleDtoSchema.safeParse",
    );
    await expect(readFile(join(root, "pnpm-workspace.yaml"), "utf8")).rejects.toThrow();
    await expect(readFile(join(root, "turbo.json"), "utf8")).rejects.toThrow();
  });

  it("rejects path traversal and existing targets", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "guard-template-"));
    const options = { cwd, run: async () => undefined };
    await expect(scaffoldProject(
      { projectName: "../escape", mode: "standard", framework: "express", contextSync: "bundled" },
      options,
    )).rejects.toThrow("Invalid project name");
    await scaffoldProject(
      { projectName: "same", mode: "standard", framework: "express", contextSync: "bundled" },
      options,
    );
    await expect(scaffoldProject(
      { projectName: "same", mode: "standard", framework: "express", contextSync: "bundled" },
      options,
    )).rejects.toThrow("Target already exists");
  });

  it("requires a repository URL for Git-backed context sync", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "git-context-template-"));
    await expect(scaffoldProject(
      { projectName: "submodule-project", mode: "standard", framework: "express", contextSync: "submodule" },
      { cwd, run: async () => undefined },
    )).rejects.toThrow("A context-factory repository URL is required for Git-backed sync.");
  });
});
