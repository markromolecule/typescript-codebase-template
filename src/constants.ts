export const CONTEXT_VALIDATE_SCRIPT = "node context-factory/scripts/validate-context.mjs";

export const OFFICIAL_CONTEXT_REPOSITORY =
  "https://github.com/markromolecule/context-factory.git";

export function getContextPullScript(method: "bundled" | "submodule" | "standalone"): string {
  if (method === "submodule") {
    return "git submodule update --remote --merge";
  }
  if (method === "standalone") {
    return 'node -e "console.log(\'Standalone context-factory snapshots do not support in-place pulls. Replace context-factory/ from the configured upstream repository.\')"';
  }
  return 'node -e "console.log(\'Bundled context-factory snapshot included by Octo. Replace context-factory/ from upstream or rerun Octo with --context-repo for Git-backed sync.\')"';
}

export const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export const frameworkLabel = {
  vite: "React + Vite",
  next: "Next.js",
  astro: "Astro",
  hono: "Hono",
  express: "Express",
} as const;
