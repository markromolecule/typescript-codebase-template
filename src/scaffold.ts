import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import {
  CONTEXT_VALIDATE_SCRIPT,
  frameworkLabel,
  getContextPullScript,
  PROJECT_NAME_PATTERN,
} from "./constants.js";
import { addPackageScript, writeJson, writeText } from "./files.js";
import {
  createBackend,
  createDatabase,
  createFrontend,
  createMinimalStandard,
  createSharedPackages,
} from "./templates.js";
import type { Answers, Framework, ScaffoldOptions } from "./types.js";

type Runner = NonNullable<ScaffoldOptions["run"]>;

const defaultRunner: Runner = async (command, args, cwd) => {
  await execa(command, args, { cwd, stdio: "inherit" });
};

const bundledContextFactoryPath = fileURLToPath(new URL("../context-factory", import.meta.url));

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function assertValidAnswers(answers: Answers): void {
  if (!PROJECT_NAME_PATTERN.test(answers.projectName)) {
    throw new Error(`Invalid project name: ${answers.projectName}`);
  }
  if (answers.mode === "monorepo" && (!answers.frontend || !answers.backend)) {
    throw new Error("Monorepo mode requires frontend and backend frameworks.");
  }
  if (answers.mode === "standard" && !answers.framework) {
    throw new Error("Standard mode requires one framework.");
  }
}

async function createMonorepo(root: string, answers: Answers): Promise<void> {
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
    },
    devDependencies: { turbo: "latest", typescript: "^5.9.3" },
  });
  await writeText(join(root, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n  - "packages/*"');
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
  await writeText(join(root, ".gitignore"), 'node_modules/\n.turbo/\n.env\n.next/\ndist/');
}

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
      - name: Check out repository
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.28.1

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate database types when configured
        run: pnpm run --if-present db:generate

      - name: Typecheck when configured
        run: pnpm run --if-present typecheck

      - name: Test when configured
        run: pnpm run --if-present test

      - name: Build
        run: pnpm run build
`,
    ),
    writeText(
      join(root, ".github/workflows/README.md"),
      "# Workflows\n\n`ci.yml` installs dependencies, generates database types when available, typechecks, tests, and builds the project. Add deployment workflows here after configuring the target host and repository secrets.",
    ),
    writeText(
      join(root, ".github/workflows/deploy.yml"),
      `name: Deploy

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  prepare:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Deployment configuration required
        run: echo "Configure the target host, repository environment, and secrets before adding deployment commands."
`,
    ),
    writeText(
      join(root, ".github/dependabot.yml"),
      `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 10

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
`,
    ),
  ]);
}

async function runOfficialGenerator(
  parent: string,
  projectName: string,
  framework: Framework,
  run: Runner,
): Promise<void> {
  if (framework === "vite") {
    await run("pnpm", ["dlx", "create-vite@latest", projectName, "--template", "react-ts"], parent);
  } else if (framework === "next") {
    await run("pnpm", ["dlx", "create-next-app@latest", projectName, "--ts", "--eslint", "--app", "--src-dir", "--use-pnpm", "--no-tailwind", "--import-alias", "@/*", "--yes"], parent);
  } else if (framework === "astro") {
    await run("pnpm", ["dlx", "create-astro@latest", projectName, "--template", "minimal", "--typescript", "strict", "--no-install", "--no-git", "--yes"], parent);
  } else {
    await mkdir(join(parent, projectName), { recursive: true });
    await createMinimalStandard(join(parent, projectName), framework);
  }
}

async function installContextFactory(
  root: string,
  method: Answers["contextSync"],
  repository: string | undefined,
  run: Runner,
): Promise<void> {
  if (method === "bundled") {
    await cp(bundledContextFactoryPath, join(root, "context-factory"), { recursive: true });
    await rm(join(root, "context-factory/.git"), { recursive: true, force: true });
    return;
  }
  if (!repository?.trim()) {
    throw new Error("A context-factory repository URL is required for Git-backed sync.");
  }
  if (method === "submodule") {
    if (!(await exists(join(root, ".git")))) await run("git", ["init"], root);
    await run("git", ["submodule", "add", repository, "context-factory"], root);
  } else {
    await run("git", ["clone", repository, "context-factory"], root);
    await rm(join(root, "context-factory/.git"), { recursive: true, force: true });
  }
}

async function createContextEntrypoints(root: string): Promise<void> {
  const shared = "Before changing this project, read `context-factory/orchestrator/SHARED.md` and `context-factory/context-manifest.json`. Load only task-relevant rules and skills. Run `pnpm context:validate` after changing context files.";
  await Promise.all([
    writeText(join(root, "AGENTS.md"), `# Project Agent Entry Point\n\n${shared}`),
    writeText(join(root, "CLAUDE.md"), `# Claude Project Entry Point\n\n${shared}\n\nUse \`context-factory/orchestrator/CLAUDE.md\` for adapter-specific presentation guidance.`),
    writeText(join(root, "GEMINI.md"), `# Gemini Project Entry Point\n\n${shared}\n\nUse \`context-factory/orchestrator/GEMINI.md\` for adapter-specific presentation guidance.`),
  ]);
}

async function writeReadme(root: string, answers: Answers): Promise<void> {
  const framework = answers.mode === "standard" ? answers.framework! : answers.frontend!;
  const devCommand = answers.mode === "monorepo" ? "pnpm turbo run dev" : "pnpm dev";
  const structure = answers.mode === "monorepo"
    ? `A pnpm + Turborepo workspace with ${frameworkLabel[answers.frontend!]} in \`apps/web\`, ${frameworkLabel[answers.backend!]} in \`apps/api\`, and shared packages.`
    : `A standard ${frameworkLabel[framework]} project with context-factory layered into the project root.`;
  const contextNote = answers.contextSync === "submodule"
    ? "Use `pnpm context:pull` to update the Git submodule, then run `pnpm context:validate`."
    : answers.contextSync === "standalone"
      ? "This project contains a standalone `context-factory/` snapshot with nested Git metadata removed. Refresh it by replacing `context-factory/` from the configured upstream repository, then run `pnpm context:validate`."
      : "This project contains the bundled `context-factory/` snapshot that shipped with Octo. Refresh it by replacing `context-factory/` from upstream or rerunning Octo with `--context-repo` for Git-backed sync, then run `pnpm context:validate`.";
  await writeText(join(root, "README.md"), `# ${answers.projectName}\n\n${structure}\n\n## Start\n\n\`\`\`sh\npnpm install\n${devCommand}\n\`\`\`\n\n## Context factory\n\nValidate the included rules, skills, and workflows with:\n\n\`\`\`sh\npnpm context:validate\n\`\`\`\n\nOpen \`context-factory/\` as the Obsidian vault to navigate the complete rules, skills, orchestrators, tasks, and decisions graph.\n\n> ${contextNote}\n`);
}

export async function scaffoldProject(answers: Answers, options: ScaffoldOptions): Promise<string> {
  assertValidAnswers(answers);
  const parent = resolve(options.cwd);
  const root = resolve(parent, answers.projectName);
  if (dirname(root) !== parent) throw new Error("Project must be created directly inside the working directory.");
  if (await exists(root)) throw new Error(`Target already exists: ${root}`);
  const run = options.run ?? defaultRunner;

  if (answers.mode === "monorepo") await createMonorepo(root, answers);
  else await runOfficialGenerator(parent, answers.projectName, answers.framework!, run);

  const packageJsonPath = join(root, "package.json");
  if (!(await exists(packageJsonPath))) {
    throw new Error("Framework generator completed without creating package.json.");
  }
  await addPackageScript(packageJsonPath, "context:pull", getContextPullScript(answers.contextSync));
  await createProjectInfrastructure(root);
  await installContextFactory(root, answers.contextSync, options.contextRepository, run);
  await addPackageScript(packageJsonPath, "context:validate", CONTEXT_VALIDATE_SCRIPT);
  await createContextEntrypoints(root);
  await writeReadme(root, answers);
  return root;
}

export async function readGeneratedPackage(root: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(join(root, "package.json"), "utf8")) as Record<string, unknown>;
}
