# 🐙 Octo CLI

Octo is an interactive TypeScript CLI that creates either a pnpm + Turborepo workspace or a framework-standard single application. Every generated project includes a reusable bundled `context-factory` snapshot and a `context:pull` script.

## Use

Run the published CLI from any directory:

```sh
pnpm dlx @markromolecule/octo@latest
```

By default, the CLI copies the bundled `context-factory` that ships inside the npm package. Override it only when using a fork or private factory:

```sh
pnpm dlx @markromolecule/octo@latest \
  --context-repo https://github.com/your-org/context-factory.git
```

Install it globally when you want the shorter command:

```sh
pnpm add --global @markromolecule/octo
octo --version
octo
```

Octo prints its package version in the terminal as `🐙 Octo CLI v<version>`. The former `@markromolecule/create-monorepo-template` package remains the legacy package; new releases use `@markromolecule/octo`.

You may also set `CONTEXT_FACTORY_REPO` instead of passing the option. An explicit `--context-repo` takes precedence over the environment variable. Git-backed sync modes use the provided repository; bundled mode does not require network access.

The prompts ask for the project name, Monorepo or Standard structure, the applicable framework choices, and the context-factory delivery method.

## Generated modes

Monorepo mode creates:

- `apps/web` using React + Vite, Next.js, or Astro
- `apps/api` using Hono or Express, with a mounted vertical `sample` module demonstrating DTO, route, controller, service, and data boundaries
- `packages/db` with Prisma migrations and `prisma-kysely`-generated types used by a Kysely runtime client
- `packages/ui`, `hooks`, `services`, `shared`, `tsconfig`, and `eslint-config`; the shared package starts with `schemas`, `types`, `utils`, and `constants` source directories
- `pnpm-workspace.yaml` and `turbo.json`

Standard mode uses the official Vite, Next.js, or Astro generator. Hono and Express use small conventional TypeScript starters. It never creates workspace files or workspace directories.

Both modes also create project infrastructure:

- `.nvmrc` targeting Node.js 20
- `.npmrc` with pnpm workspace and peer-dependency defaults
- `.github/workflows/ci.yml` for install, generation, typecheck, test, and build checks
- `.github/workflows/deploy.yml` as a safe manual deployment placeholder
- `.github/workflows/README.md` as the deployment-workflow handoff point
- `.github/dependabot.yml` for weekly npm and GitHub Actions updates
- root `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` pointers so tools discover the nested factory
- `context:validate` to check the factory manifest, skills, links, and Obsidian configuration

Backend starters include `src/modules/sample/` with action-first files such as `create-sample.service.ts`, `create-sample.controller.ts`, and `create-sample.data.ts`. Use singular feature names for one-record operations and plural names such as `delete-samples.service.ts` for true bulk operations.

`turbo.json` remains Monorepo-only; Standard projects retain their framework's normal structure.

## Context delivery behavior

- **Bundled Snapshot** copies the packaged `context-factory/` into the generated project with no Git or network dependency.
- **Git Submodule** initializes Git when needed and adds `context-factory/` as a submodule. `pnpm context:pull` updates it.
- **Direct Clone (Standalone)** clones the repository and removes its nested `.git` directory. Since removing Git metadata prevents a later `git pull`, refresh standalone copies by replacing `context-factory/` from upstream. The generated `context:pull` script explains that limitation.

## Develop

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Node.js 20 or newer is required. The executable is published through the `octo` bin in the scoped npm package.
