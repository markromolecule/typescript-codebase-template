import { fileURLToPath } from "node:url";
import { access, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { execa } from "execa";
import {
  CONTEXT_BRIDGE_SCRIPT,
  CONTEXT_DOCTOR_SCRIPT,
  CONTEXT_PULL_SCRIPT,
  CONTEXT_VALIDATE_SCRIPT,
  frameworkLabel,
  PROJECT_NAME_PATTERN,
  WORKSPACE_APPS_GLOB,
} from "./constants.js";
import { addPackageScript, copyDirectory, readJson, writeJson, writeText } from "./files.js";
import { configureStyling, getStylingLabel } from "./styling.js";
import {
  createBackend,
  createDatabase,
  createFrontend,
  createMinimalStandard,
  createSharedPackages,
} from "./templates.js";
import type { Answers, BackendFramework, FrontendFramework, ScaffoldOptions } from "./types.js";

type Runner = NonNullable<ScaffoldOptions["run"]>;

const defaultRunner: Runner = async (command, args, cwd) => {
  try {
    await execa(command, args, { cwd, stdio: "pipe" });
  } catch (error: unknown) {
    if (
      error
      && typeof error === "object"
      && "stderr" in error
      && typeof error.stderr === "string"
      && error.stderr.trim()
    ) {
      throw new Error(`Command failed: ${command} ${args.join(" ")}\n${error.stderr}`);
    }
    throw error;
  }
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function assertValidAnswers(answers: Answers): void {
  if (!PROJECT_NAME_PATTERN.test(answers.projectName)) {
    throw new Error(`Invalid project name: ${answers.projectName}`);
  }
  if (answers.architecture === "monorepo" && (!answers.frontend || !answers.backend)) {
    throw new Error("Monorepo architecture requires frontend and backend frameworks.");
  }
  if (answers.architecture === "frontend" && !answers.frontend) {
    throw new Error("Frontend architecture requires a frontend framework.");
  }
  if (answers.architecture === "backend" && !answers.backend) {
    throw new Error("Backend architecture requires a backend framework.");
  }
}

// ---------------------------------------------------------------------------
// Root package.json (proxy scripts + context scripts) for single-app layout
// ---------------------------------------------------------------------------

async function writeRootPackageJson(
  root: string,
  projectName: string,
  architecture: "frontend" | "backend",
): Promise<void> {
  const devScript = architecture === "frontend"
    ? "pnpm --prefix app dev"
    : "pnpm --prefix app dev";
  await writeJson(join(root, "package.json"), {
    name: projectName,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: devScript,
      build: "pnpm --prefix app build",
      start: "pnpm --prefix app start",
      test: "pnpm --prefix app test",
      "context:pull": CONTEXT_PULL_SCRIPT,
      "context:bridge": CONTEXT_BRIDGE_SCRIPT,
      "context:validate": CONTEXT_VALIDATE_SCRIPT,
      "context:doctor": CONTEXT_DOCTOR_SCRIPT,
    },
  });
}

// ---------------------------------------------------------------------------
// Frontend single-app generation (app/ directory)
// ---------------------------------------------------------------------------

async function createFrontendApp(root: string, answers: Answers): Promise<void> {
  const appDir = join(root, "app");
  await mkdir(appDir, { recursive: true });
  // createFrontend expects the workspace root and will place files in app/web
  // For single-app, we adapt: generate directly into appDir
  const framework = answers.frontend as FrontendFramework;
  await createStandaloneFrontend(appDir, framework);
}

async function createStandaloneFrontend(appDir: string, framework: FrontendFramework): Promise<void> {
  if (framework === "vite") {
    await writeJson(join(appDir, "package.json"), {
      name: "app",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: { dev: "vite", build: "tsc -b && vite build", start: "vite preview", test: "vitest" },
      dependencies: { react: "latest", "react-dom": "latest" },
      devDependencies: {
        "@types/react": "latest",
        "@types/react-dom": "latest",
        "@vitejs/plugin-react": "latest",
        typescript: "^5.9.3",
        vite: "latest",
      },
    });
    await writeJson(join(appDir, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["src", "vite.config.ts"],
    });
    await writeText(join(appDir, "vite.config.ts"), 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({ plugins: [react()] });');
    await writeText(join(appDir, "index.html"), '<div id="root"></div><script type="module" src="/src/main.tsx"></script>');
    await writeText(join(appDir, "src/main.tsx"), 'import React from "react";\nimport { createRoot } from "react-dom/client";\nimport "./style.css";\n\ncreateRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <main>\n      <h1>React + Vite</h1>\n      <p>Your project is ready.</p>\n    </main>\n  </React.StrictMode>,\n);');
    await writeText(join(appDir, "src/style.css"), ':root { font-family: system-ui, sans-serif; color-scheme: light dark; }\nbody { margin: 0; }\nmain { max-width: 48rem; margin: 5rem auto; padding: 2rem; }');
    return;
  }
  if (framework === "next") {
    await writeJson(join(appDir, "package.json"), {
      name: "app",
      private: true,
      version: "0.0.0",
      scripts: { dev: "next dev", build: "next build", start: "next start", lint: "eslint ." },
      dependencies: { next: "latest", react: "latest", "react-dom": "latest" },
      devDependencies: {
        "@types/node": "latest",
        "@types/react": "latest",
        "@types/react-dom": "latest",
        typescript: "^5.9.3",
      },
    });
    await writeJson(join(appDir, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "preserve",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        plugins: [{ name: "next" }],
        paths: { "@/*": ["./src/*"] },
      },
      include: ["next-env.d.ts", ".next/types/**/*.ts", "**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    });
    await writeText(join(appDir, "next-env.d.ts"), '/// <reference types="next" />\n/// <reference types="next/image-types/global" />');
    await writeText(join(appDir, "next.config.ts"), 'import type { NextConfig } from "next";\nconst config: NextConfig = {};\nexport default config;');
    await writeText(join(appDir, "src/app/layout.tsx"), 'import type { ReactNode } from "react";\nexport default function Layout({ children }: { children: ReactNode }) {\n  return <html lang="en"><body>{children}</body></html>;\n}');
    await writeText(join(appDir, "src/app/page.tsx"), 'export default function Page() {\n  return <main><h1>Next.js</h1><p>Your project is ready.</p></main>;\n}');
    await writeText(join(appDir, "src/app/globals.css"), ':root { font-family: system-ui, sans-serif; }\nbody { margin: 0; }\nmain { max-width: 48rem; margin: 5rem auto; padding: 2rem; }');
    return;
  }
  // astro
  await writeJson(join(appDir, "package.json"), {
    name: "app",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: { dev: "astro dev", build: "astro build", start: "astro preview", preview: "astro preview" },
    dependencies: { astro: "latest" },
    devDependencies: { typescript: "^5.9.3" },
  });
  await writeJson(join(appDir, "tsconfig.json"), { extends: "astro/tsconfigs/strict" });
  await writeText(join(appDir, "astro.config.mjs"), 'import { defineConfig } from "astro/config";\nexport default defineConfig({});');
  await writeText(join(appDir, "src/pages/index.astro"), '---\nconst title = "Astro";\n---\n<html lang="en"><head><meta charset="utf-8" /><title>{title}</title></head><body><main><h1>{title}</h1><p>Your project is ready.</p></main></body></html>');
}

// ---------------------------------------------------------------------------
// Backend single-app generation (app/ directory)
// ---------------------------------------------------------------------------

async function createBackendApp(root: string, answers: Answers): Promise<void> {
  const appDir = join(root, "app");
  await mkdir(appDir, { recursive: true });
  await createMinimalStandard(appDir, answers.backend as BackendFramework);
}

// ---------------------------------------------------------------------------
// Monorepo generation (app/web + app/api + packages/)
// ---------------------------------------------------------------------------

async function createMonorepoApp(root: string, answers: Answers): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeJson(join(root, "package.json"), {
    name: answers.projectName,
    version: "0.1.0",
    private: true,
    packageManager: "pnpm@10.28.1",
    scripts: {
      build: "turbo run build",
      dev: "turbo run dev",
      "db:generate": "turbo run db:generate",
      "context:pull": CONTEXT_PULL_SCRIPT,
      "context:bridge": CONTEXT_BRIDGE_SCRIPT,
      "context:validate": CONTEXT_VALIDATE_SCRIPT,
      "context:doctor": CONTEXT_DOCTOR_SCRIPT,
    },
    devDependencies: { turbo: "latest", typescript: "^5.9.3" },
  });
  await writeText(
    join(root, "pnpm-workspace.yaml"),
    `packages:\n  - "${WORKSPACE_APPS_GLOB}"\n  - "packages/*"`,
  );
  await writeJson(join(root, "turbo.json"), {
    $schema: "https://turbo.build/schema.json",
    tasks: {
      build: { dependsOn: ["^build"], outputs: [".next/**", "dist/**"] },
      "db:generate": { cache: false },
      dev: { persistent: true, cache: false },
    },
  });
  await Promise.all([
    createFrontend(root, answers.frontend!),
    createBackend(root, answers.backend!),
    createSharedPackages(root),
    createDatabase(root),
  ]);
  await writeText(join(root, ".gitignore"), "node_modules/\n.turbo/\n.env\n.next/\ndist/");
}

// ---------------------------------------------------------------------------
// Shared infrastructure
// ---------------------------------------------------------------------------

async function createProjectInfrastructure(root: string): Promise<void> {
  await Promise.all([
    writeText(join(root, ".nvmrc"), "20"),
    writeText(
      join(root, ".npmrc"),
      "engine-strict=true\nauto-install-peers=true\nstrict-peer-dependencies=false\nprefer-workspace-packages=true\nshared-workspace-lockfile=true",
    ),
    writeText(
      join(root, ".github/workflows/ci.yml"),
      `name: CI

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: true
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
`,
    ),
  ]);
}

async function installContextFactory(
  root: string,
  options: ScaffoldOptions,
  run: Runner,
): Promise<void> {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const bundledFactory = join(packageRoot, "context-factory");
  const targetFactory = join(root, "context-factory");
  if (options.contextRepository !== undefined) {
    if (!options.contextRepository.trim()) {
      throw new Error("A context-factory repository URL is required for Git submodule sync.");
    }
    if (!(await exists(join(root, ".git")))) await run("git", ["init"], root);
    await run("git", ["submodule", "add", options.contextRepository, "context-factory"], root);
  } else if (await exists(bundledFactory)) {
    await copyDirectory(bundledFactory, targetFactory, (src) => !src.includes("/.git"));
  } else {
    throw new Error("No bundled context-factory found and no repository provided.");
  }
  const bridgeCli = join(root, "context-factory/app/cli/bin/context-cli.mjs");
  if (await exists(bridgeCli)) {
    await run("node", [bridgeCli, "bridge", "--target", "."], root);
  }
}

async function createContextEntrypoints(root: string, answers: Answers): Promise<void> {
  const hasFrontend = answers.architecture === "frontend" || answers.architecture === "monorepo";
  const appNote = answers.architecture === "monorepo"
    ? " Application code lives in `app/web` (frontend) and `app/api` (backend)."
    : " Application code lives in `app/`.";
  const frontendNote = hasFrontend ? " For frontend work, also read `docs/design-pattern.md`." : "";
  const shared = `Before changing this project, read \`context-factory/orchestrator/SHARED.md\` and \`context-factory/context-manifest.json\`. Load only task-relevant rules and skills.${frontendNote}${appNote} Run \`pnpm context:validate\` after changing context files.`;
  await Promise.all([
    writeText(join(root, "AGENTS.md"), `# Project Agent Entry Point\n\n${shared}`),
    writeText(join(root, "CLAUDE.md"), `# Claude Project Entry Point\n\n${shared}\n\nUse \`context-factory/orchestrator/CLAUDE.md\` for adapter-specific presentation guidance.`),
    writeText(join(root, "GEMINI.md"), `# Gemini Project Entry Point\n\n${shared}\n\nUse \`context-factory/orchestrator/GEMINI.md\` for adapter-specific presentation guidance.`),
  ]);
}

async function writeDesignPatternProfile(root: string, answers: Answers): Promise<void> {
  const framework = answers.architecture === "monorepo" ? answers.frontend : answers.frontend;
  if (!framework || (framework !== "vite" && framework !== "next" && framework !== "astro")) return;
  const styling = answers.styling ?? "none";
  const isMonorepo = answers.architecture === "monorepo";
  const owner = isMonorepo ? "`packages/ui`" : "the application source tree in `app/`";
  const consumer = isMonorepo ? "`app/web` consumes `@workspace/ui`" : "components remain local to `app/`";
  const addCommand = styling === "shadcn"
    ? isMonorepo
      ? "`pnpm dlx shadcn@latest add <component> -c app/web` routes shared primitives into `packages/ui`."
      : "Run `pnpm dlx shadcn@latest add <component>` from inside `app/`."
    : "Add new primitives through the selected system's existing package and configuration; do not introduce a second UI system by default.";
  await writeText(
    join(root, "docs/design-pattern.md"),
    `# Generated frontend design pattern

This project selected **${frameworkLabel[framework]}** with **${getStylingLabel(styling)}** during scaffolding.

## Architecture

- Styling and reusable component ownership: ${owner}.
- Consumption boundary: ${consumer}.
- Keep route- and feature-specific composition in the frontend application; keep reusable, data-agnostic primitives in ${owner}.
- Build-tool adapters may remain in the application package, but styling-system dependencies and shared primitives belong to their owning UI package.

## Design-system contract

- Use the selected styling system and its tokens before adding another library.
- Adapt library defaults to the product's content and visual language; do not ship an unchanged generic theme.
- Avoid unnecessary wrappers, cards inside cards, excessive shadows, generic gradients, and decorative section badges.
- Every wrapper must have a semantic, layout, responsive, or interaction purpose.
- Follow \`context-factory/rules/ui/frontend.md\` and the most-specific frontend rules before creating pages or components.

## Component workflow

${addCommand}
`,
  );
}

async function writeReadme(root: string, answers: Answers): Promise<void> {
  const { architecture, projectName } = answers;
  const devCommand = architecture === "monorepo" ? "pnpm turbo run dev" : "pnpm dev";
  let structure: string;
  if (architecture === "monorepo") {
    structure = `A pnpm + Turborepo workspace with ${frameworkLabel[answers.frontend!]} in \`app/web\`, ${frameworkLabel[answers.backend!]} in \`app/api\`, and shared packages.\n\n\`\`\`\n${projectName}/\n├── app/\n│   ├── web/        # Frontend (${frameworkLabel[answers.frontend!]})\n│   └── api/        # Backend (${frameworkLabel[answers.backend!]})\n├── packages/       # Shared UI, hooks, services, db\n└── context-factory/\n\`\`\``;
  } else if (architecture === "frontend") {
    structure = `A ${frameworkLabel[answers.frontend!]} frontend application.\n\n\`\`\`\n${projectName}/\n├── app/            # Frontend (${frameworkLabel[answers.frontend!]})\n└── context-factory/\n\`\`\``;
  } else {
    structure = `A ${frameworkLabel[answers.backend!]} backend API.\n\n\`\`\`\n${projectName}/\n├── app/            # Backend (${frameworkLabel[answers.backend!]})\n└── context-factory/\n\`\`\``;
  }
  const hasFrontend = architecture === "frontend" || architecture === "monorepo";
  const stylingNote = hasFrontend
    ? `\n\n## Frontend design system\n\nThis project uses **${getStylingLabel(answers.styling)}**. Read \`docs/design-pattern.md\` before changing frontend components or pages.${architecture === "monorepo" ? " Shared UI primitives and styling dependencies are owned by `packages/ui`." : ""}`
    : "";
  const contextNote = "Use `pnpm context:pull` to update context-factory, then run `pnpm context:validate`.";
  await writeText(
    join(root, "README.md"),
    `# ${projectName}\n\n${structure}${stylingNote}\n\n## Start\n\n\`\`\`sh\ncd ${projectName}\npnpm install\n${devCommand}\n\`\`\`\n\n## Context factory\n\nValidate the included rules, skills, and workflows with:\n\n\`\`\`sh\npnpm context:validate\n\`\`\`\n\nOpen \`context-factory/\` as the Obsidian vault to navigate the complete rules, skills, orchestrators, tasks, and decisions graph.\n\n> ${contextNote}\n`,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function scaffoldProject(answers: Answers, options: ScaffoldOptions): Promise<string> {
  assertValidAnswers(answers);
  const parent = resolve(options.cwd);
  const root = resolve(parent, answers.projectName);
  if (dirname(root) !== parent) throw new Error("Project must be created directly inside the working directory.");
  if (await exists(root)) throw new Error(`Target already exists: ${root}`);
  const run = options.run ?? defaultRunner;

  // 1. Generate application code
  if (answers.architecture === "monorepo") {
    await createMonorepoApp(root, answers);
  } else if (answers.architecture === "frontend") {
    await createFrontendApp(root, answers);
    await writeRootPackageJson(root, answers.projectName, "frontend");
  } else {
    await createBackendApp(root, answers);
    await writeRootPackageJson(root, answers.projectName, "backend");
  }

  // 2. Verify root package.json was created
  const rootPackageJsonPath = join(root, "package.json");
  if (!(await exists(rootPackageJsonPath))) {
    throw new Error("Scaffolding completed without creating root package.json.");
  }

  // 3. Apply styling (only for frontend/monorepo)
  await configureStyling(root, answers);

  // 4. Shared infrastructure (.npmrc, .nvmrc, CI)
  await createProjectInfrastructure(root);

  // 5. Install context-factory at root (outside app/)
  await installContextFactory(root, options, run);

  // 6. Agent entrypoints (AGENTS.md, CLAUDE.md, GEMINI.md)
  await createContextEntrypoints(root, answers);

  // 7. Documentation
  await writeDesignPatternProfile(root, answers);
  await writeReadme(root, answers);

  return root;
}

export async function readGeneratedPackage(root: string): Promise<Record<string, unknown>> {
  return readJson(join(root, "package.json"));
}
