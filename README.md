# create-monorepo-template

An interactive TypeScript CLI that creates either a pnpm + Turborepo workspace or a framework-standard single application. Every generated project includes a reusable `context-factory` checkout and a `context:pull` script.

## Use

Run the published CLI from any directory:

```sh
pnpm dlx @markromolecule/create-monorepo-template@latest
```

The CLI uses `https://github.com/markromolecule/context-factory.git` automatically. Override it only when using a fork or private factory:

```sh
pnpm dlx @markromolecule/create-monorepo-template@latest \
  --context-repo https://github.com/your-org/context-factory.git
```

You may also set `CONTEXT_FACTORY_REPO` instead of passing the option. An explicit `--context-repo` takes precedence over the environment variable.

The prompts ask for the project name, Monorepo or Standard structure, the applicable framework choices, and the context-factory sync method.

## Generated modes

Monorepo mode creates:

- `apps/web` using React + Vite, Next.js, or Astro
- `apps/api` using Hono or Express
- `packages/db` with Prisma migrations and `prisma-kysely`-generated types used by a Kysely runtime client
- `packages/ui`, `hooks`, `services`, `shared`, `tsconfig`, and `eslint-config`
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

`turbo.json` remains Monorepo-only; Standard projects retain their framework's normal structure.

## Context sync behavior

- **Git Submodule** initializes Git when needed and adds `context-factory/` as a submodule. `pnpm context:pull` updates it.
- **Direct Clone (Standalone)** clones the repository and removes its nested `.git` directory, as required by the specification. Since removing Git metadata prevents a later `git pull`, refresh standalone copies by replacing `context-factory/` from upstream. The required `context:pull` script remains present for compatibility.

## Develop

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Node.js 20 or newer is required. The executable is published through the `create-monorepo-template` bin in the scoped npm package.
