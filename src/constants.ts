export const CONTEXT_VALIDATE_SCRIPT = "node context-factory/scripts/validate-context.mjs";
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
