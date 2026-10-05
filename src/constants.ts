export const CONTEXT_VALIDATE_SCRIPT = "node context-factory/scripts/validate-context.mjs";
export const CONTEXT_BRIDGE_SCRIPT = "node ./context-factory/app/cli/bin/context-cli.mjs bridge --target .";
export const CONTEXT_DOCTOR_SCRIPT = "node ./context-factory/scripts/context.mjs doctor";
export const CONTEXT_PULL_SCRIPT = "git submodule update --remote --merge";

export const OFFICIAL_CONTEXT_REPOSITORY =
  "https://github.com/markromolecule/context-factory.git";

export function getContextPullScript(): string {
  return CONTEXT_PULL_SCRIPT;
}

export const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export const frameworkLabel = {
  vite: "React + Vite",
  next: "Next.js",
  astro: "Astro",
  hono: "Hono",
  express: "Express",
} as const;

export const architectureLabels = {
  frontend: "Frontend Web App (Next.js, Astro, React + Vite)",
  backend: "Backend API (Hono, Express)",
  monorepo: "Fullstack Monorepo (Web + API + Shared Packages)",
} as const;

/** Glob patterns for pnpm-workspace.yaml in a monorepo (app/* + packages/*). */
export const WORKSPACE_APPS_GLOB = "app/*";
