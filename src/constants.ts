export const CONTEXT_PULL_SCRIPT =
  "git submodule update --remote --merge || (cd context-factory && git pull origin main)";

export const CONTEXT_VALIDATE_SCRIPT = "node context-factory/scripts/validate-context.mjs";

export const DEFAULT_CONTEXT_REPOSITORY =
  "https://github.com/markromolecule/context-factory.git";

export const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export const frameworkLabel = {
  vite: "React + Vite",
  next: "Next.js",
  astro: "Astro",
  hono: "Hono",
  express: "Express",
} as const;
