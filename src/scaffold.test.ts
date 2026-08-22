import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
    expect(await readFile(join(root, "context-factory/context-manifest.json"), "utf8")).toContain('"contextVersion": "3.6.0"');
    expect(await readFile(join(root, "docs/design-pattern.md"), "utf8")).toContain("Framework default");
    expect(calls).toEqual([]);
  });

  it("routes shadcn/ui into packages/ui and configures Astro as its consumer", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "shadcn-monorepo-"));
    const root = await scaffoldProject(
      {
        projectName: "shadcn-app",
        mode: "monorepo",
        frontend: "astro",
        backend: "hono",
        styling: "shadcn",
        contextSync: "bundled",
      },
      { cwd, run: async () => undefined },
    );

    const uiPackage = JSON.parse(await readFile(join(root, "packages/ui/package.json"), "utf8"));
    const webPackage = JSON.parse(await readFile(join(root, "apps/web/package.json"), "utf8"));
    expect(uiPackage.dependencies.shadcn).toBe("latest");
    expect(uiPackage.dependencies["tailwind-merge"]).toBe("latest");
    expect(uiPackage.exports["./components/*"]).toBe("./src/components/*.tsx");
    expect(webPackage.dependencies["@workspace/ui"]).toBe("workspace:*");
    expect(webPackage.dependencies["@astrojs/react"]).toBe("latest");
    expect(await readFile(join(root, "packages/ui/components.json"), "utf8")).toContain("@workspace/ui/components");
    expect(await readFile(join(root, "apps/web/components.json"), "utf8")).toContain("../../packages/ui/src/styles/globals.css");
    expect(await readFile(join(root, "apps/web/astro.config.mjs"), "utf8")).toContain("integrations: [react()]");
    expect(await readFile(join(root, "apps/web/src/pages/index.astro"), "utf8")).toContain('@workspace/ui/globals.css');
    expect(await readFile(join(root, "docs/design-pattern.md"), "utf8")).toContain(
      "routes shared primitives into `packages/ui`",
    );
  });

  it("configures daisyUI in packages/ui with the Next.js PostCSS adapter", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "daisy-monorepo-"));
    const root = await scaffoldProject(
      {
        projectName: "daisy-app",
        mode: "monorepo",
        frontend: "next",
        backend: "express",
        styling: "daisyui",
        contextSync: "bundled",
      },
      { cwd, run: async () => undefined },
    );

    const uiPackage = JSON.parse(await readFile(join(root, "packages/ui/package.json"), "utf8"));
    const webPackage = JSON.parse(await readFile(join(root, "apps/web/package.json"), "utf8"));
    expect(uiPackage.devDependencies.daisyui).toBe("latest");
    expect(webPackage.devDependencies["@tailwindcss/postcss"]).toBe("latest");
    expect(await readFile(join(root, "packages/ui/src/styles.css"), "utf8")).toContain('@plugin "daisyui"');
    expect(await readFile(join(root, "apps/web/postcss.config.mjs"), "utf8")).toContain("@tailwindcss/postcss");
    expect(await readFile(join(root, "apps/web/app/layout.tsx"), "utf8")).toContain('@workspace/ui/styles.css');
  });

  it("configures Bootstrap in packages/ui without adding Tailwind tooling", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bootstrap-monorepo-"));
    const root = await scaffoldProject(
      {
        projectName: "bootstrap-app",
        mode: "monorepo",
        frontend: "vite",
        backend: "hono",
        styling: "bootstrap",
        contextSync: "bundled",
      },
      { cwd, run: async () => undefined },
    );

    const uiPackage = JSON.parse(await readFile(join(root, "packages/ui/package.json"), "utf8"));
    const webPackage = JSON.parse(await readFile(join(root, "apps/web/package.json"), "utf8"));
    expect(uiPackage.dependencies.bootstrap).toBe("latest");
    expect(uiPackage.devDependencies.tailwindcss).toBeUndefined();
    expect(webPackage.devDependencies["@tailwindcss/vite"]).toBeUndefined();
    expect(await readFile(join(root, "packages/ui/src/styles.css"), "utf8")).toContain(
      '@import "bootstrap/dist/css/bootstrap.min.css"',
    );
    expect(await readFile(join(root, "apps/web/src/style.css"), "utf8")).toContain('@workspace/ui/styles.css');
  });

  it("configures standalone Tailwind CSS in packages/ui and the Vite build adapter", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "tailwind-monorepo-"));
    const root = await scaffoldProject(
      {
        projectName: "tailwind-app",
        mode: "monorepo",
        frontend: "vite",
        backend: "hono",
        styling: "tailwind",
        contextSync: "bundled",
      },
      { cwd, run: async () => undefined },
    );

    const uiPackage = JSON.parse(await readFile(join(root, "packages/ui/package.json"), "utf8"));
    const webPackage = JSON.parse(await readFile(join(root, "apps/web/package.json"), "utf8"));
    expect(uiPackage.devDependencies.tailwindcss).toBe("latest");
    expect(uiPackage.devDependencies.daisyui).toBeUndefined();
    expect(uiPackage.dependencies?.shadcn).toBeUndefined();
    expect(webPackage.devDependencies["@tailwindcss/vite"]).toBe("latest");
    expect(await readFile(join(root, "packages/ui/src/styles.css"), "utf8")).toContain('@import "tailwindcss"');
    expect(await readFile(join(root, "apps/web/vite.config.ts"), "utf8")).toContain("tailwindcss()");
  });

  it("configures shadcn/ui inside a standard Vite application", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "shadcn-standard-"));
    const root = await scaffoldProject(
      {
        projectName: "standard-web",
        mode: "standard",
        framework: "vite",
        styling: "shadcn",
        contextSync: "bundled",
      },
      {
        cwd,
        run: async (_command, args, parent) => {
          const projectRoot = join(parent, args[2]);
          await mkdir(join(projectRoot, "src"), { recursive: true });
          await writeFile(join(projectRoot, "package.json"), JSON.stringify({
            name: "standard-web",
            private: true,
            scripts: { dev: "vite", build: "vite build" },
            dependencies: { react: "latest", "react-dom": "latest" },
            devDependencies: { "@vitejs/plugin-react": "latest", vite: "latest", typescript: "latest" },
          }));
          await writeFile(join(projectRoot, "src/main.tsx"), 'import "./index.css";');
          await writeFile(join(projectRoot, "src/index.css"), "");
          await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify({ references: [{ path: "./tsconfig.app.json" }] }));
          await writeFile(join(projectRoot, "tsconfig.app.json"), JSON.stringify({ compilerOptions: {} }));
        },
      },
    );

    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    expect(packageJson.dependencies.shadcn).toBe("latest");
    expect(packageJson.devDependencies["@tailwindcss/vite"]).toBe("latest");
    expect(await readFile(join(root, "components.json"), "utf8")).toContain('"ui": "@/components/ui"');
    expect(await readFile(join(root, "src/lib/utils.ts"), "utf8")).toContain("twMerge(clsx(inputs))");
    expect(await readFile(join(root, "src/index.css"), "utf8")).toContain('@import "shadcn/tailwind.css"');
    expect(JSON.parse(await readFile(join(root, "tsconfig.app.json"), "utf8")).compilerOptions.paths["@/*"]).toEqual([
      "./src/*",
    ]);
    await expect(readFile(join(root, "packages/ui/package.json"), "utf8")).rejects.toThrow();
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

  it("initializes packages/ui with React support by default in monorepo regardless of styling", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ui-react-default-"));
    const root = await scaffoldProject(
      {
        projectName: "mono-react-ui",
        mode: "monorepo",
        frontend: "vite",
        backend: "hono",
        styling: "none",
        contextSync: "bundled",
      },
      { cwd, run: async () => undefined },
    );

    const uiPackage = JSON.parse(await readFile(join(root, "packages/ui/package.json"), "utf8"));
    const uiTsconfig = JSON.parse(await readFile(join(root, "packages/ui/tsconfig.json"), "utf8"));
    expect(uiPackage.peerDependencies.react).toBe("latest");
    expect(uiPackage.peerDependencies["react-dom"]).toBe("latest");
    expect(uiPackage.devDependencies["@types/react"]).toBe("latest");
    expect(uiPackage.devDependencies["@types/react-dom"]).toBe("latest");
    expect(uiTsconfig.extends).toBe("@workspace/tsconfig/react.json");
    expect(uiTsconfig.compilerOptions.jsx).toBe("react-jsx");
    expect(uiTsconfig.include).toContain("src/**/*.tsx");
  });

  it("passes fast, non-blocking arguments to official generators", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "generator-flags-"));
    const recordedCalls: { command: string; args: string[] }[] = [];
    const mockRun = async (command: string, args: string[], parent: string) => {
      recordedCalls.push({ command, args });
      const projectRoot = join(parent, args[2]);
      await mkdir(projectRoot, { recursive: true });
      await writeFile(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: args[2], private: true, scripts: { dev: "run", build: "build" } }),
      );
    };

    await scaffoldProject(
      { projectName: "next-fast", mode: "standard", framework: "next", contextSync: "bundled" },
      { cwd, run: mockRun },
    );
    expect(recordedCalls[0].command).toBe("pnpm");
    expect(recordedCalls[0].args).toContain("create-next-app@latest");
    expect(recordedCalls[0].args).toContain("--skip-install");
    expect(recordedCalls[0].args).toContain("--disable-git");
    expect(recordedCalls[0].args).toContain("--yes");

    await scaffoldProject(
      { projectName: "astro-fast", mode: "standard", framework: "astro", contextSync: "bundled" },
      { cwd, run: mockRun },
    );
    expect(recordedCalls[1].command).toBe("pnpm");
    expect(recordedCalls[1].args).toContain("create-astro@latest");
    expect(recordedCalls[1].args).toContain("--skip-houston");
    expect(recordedCalls[1].args).toContain("--no-install");
    expect(recordedCalls[1].args).toContain("--no-git");
    expect(recordedCalls[1].args).toContain("--yes");
    expect(recordedCalls[1].args).not.toContain("--typescript");

    await scaffoldProject(
      { projectName: "vite-fast", mode: "standard", framework: "vite", contextSync: "bundled" },
      { cwd, run: mockRun },
    );
    expect(recordedCalls[2].command).toBe("pnpm");
    expect(recordedCalls[2].args).toContain("create-vite@latest");
    expect(recordedCalls[2].args).toContain("--template");
    expect(recordedCalls[2].args).toContain("react-ts");
  });
});
