import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { updateJson, updatePackageJson, writeJson, writeText } from "./files.js";
import type { Answers, FrontendFramework, StylingSystem } from "./types.js";

type JsonRecord = Record<string, unknown>;

const stylingLabel: Record<StylingSystem, string> = {
  none: "Framework default",
  shadcn: "shadcn/ui",
  daisyui: "daisyUI",
  bootstrap: "Bootstrap",
  tailwind: "Tailwind CSS",
};

function mergeSection(
  packageJson: JsonRecord,
  section: "dependencies" | "devDependencies" | "peerDependencies",
  additions: Record<string, string>,
): JsonRecord {
  return {
    ...packageJson,
    [section]: {
      ...(packageJson[section] as Record<string, string> | undefined),
      ...additions,
    },
  };
}

function frontendFramework(answers: Answers): FrontendFramework | undefined {
  if (answers.mode === "monorepo") return answers.frontend;
  return answers.framework === "vite" || answers.framework === "next" || answers.framework === "astro"
    ? answers.framework
    : undefined;
}

function usesTailwind(system: StylingSystem): boolean {
  return system === "tailwind" || system === "daisyui" || system === "shadcn";
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function configureSourceAlias(
  appRoot: string,
  framework: FrontendFramework,
  isMonorepo: boolean,
): Promise<void> {
  const viteAppConfig = join(appRoot, "tsconfig.app.json");
  const tsconfigPath = framework === "vite" && await exists(viteAppConfig)
    ? viteAppConfig
    : join(appRoot, "tsconfig.json");
  const target = isMonorepo && framework === "next" ? "./*" : "./src/*";
  await updateJson(tsconfigPath, (tsconfig) => ({
    ...tsconfig,
    compilerOptions: {
      ...(tsconfig.compilerOptions as JsonRecord | undefined),
      baseUrl: ".",
      paths: {
        ...((tsconfig.compilerOptions as JsonRecord | undefined)?.paths as JsonRecord | undefined),
        "@/*": [target],
      },
    },
  }));
}

function cssContents(system: StylingSystem, isMonorepo: boolean): string {
  const sources = isMonorepo
    ? '@source "../**/*.{js,ts,jsx,tsx,astro}";\n@source "../../../apps/web/**/*.{js,ts,jsx,tsx,astro}";\n\n'
    : "";
  if (system === "bootstrap") {
    return `@import "bootstrap/dist/css/bootstrap.min.css";

:root {
  --app-content-width: 72rem;
}
`;
  }
  if (system === "daisyui") {
    return `@import "tailwindcss";
${sources}@plugin "daisyui" {
  themes: light --default, dark --prefersdark;
}
`;
  }
  if (system === "shadcn") {
    return `@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
${sources}@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --border: oklch(0.922 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --border: oklch(1 0 0 / 10%);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-border: var(--border);
  --radius-md: var(--radius);
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
`;
  }
  return `@import "tailwindcss";
${sources}`;
}

function shadcnConfig(css: string, framework: FrontendFramework, monorepoTarget: boolean): JsonRecord {
  const rsc = framework === "next";
  return {
    $schema: "https://ui.shadcn.com/schema.json",
    style: "base-nova",
    rsc,
    tsx: true,
    tailwind: { config: "", css, baseColor: "neutral", cssVariables: true },
    iconLibrary: "lucide",
    aliases: monorepoTarget
      ? {
          components: "@workspace/ui/components",
          utils: "@workspace/ui/lib/utils",
          hooks: "@workspace/ui/hooks",
          lib: "@workspace/ui/lib",
          ui: "@workspace/ui/components",
        }
      : {
          components: "@/components",
          utils: "@/lib/utils",
          hooks: "@/hooks",
          lib: "@/lib",
          ui: "@/components/ui",
        },
  };
}

async function configureTailwindAdapter(
  appRoot: string,
  framework: FrontendFramework,
  includeReact: boolean,
): Promise<void> {
  await updatePackageJson(join(appRoot, "package.json"), (packageJson) => {
    let next = mergeSection(packageJson, "devDependencies", {
      tailwindcss: "latest",
      ...(framework === "next"
        ? { "@tailwindcss/postcss": "latest", postcss: "latest" }
        : { "@tailwindcss/vite": "latest" }),
    });
    if (framework === "astro" && includeReact) {
      next = mergeSection(next, "dependencies", {
        "@astrojs/react": "latest",
        react: "latest",
        "react-dom": "latest",
      });
      next = mergeSection(next, "devDependencies", {
        "@types/react": "latest",
        "@types/react-dom": "latest",
      });
    }
    return next;
  });

  if (framework === "vite") {
    await writeText(
      join(appRoot, "vite.config.ts"),
      `import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});`,
    );
    await updatePackageJson(join(appRoot, "package.json"), (packageJson) =>
      mergeSection(packageJson, "devDependencies", { "@types/node": "latest" }));
  } else if (framework === "next") {
    await writeText(
      join(appRoot, "postcss.config.mjs"),
      `const config = { plugins: { "@tailwindcss/postcss": {} } };

export default config;`,
    );
  } else {
    await writeText(
      join(appRoot, "astro.config.mjs"),
      `import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";${includeReact ? '\nimport react from "@astrojs/react";' : ""}

export default defineConfig({
  ${includeReact ? "integrations: [react()],\n  " : ""}vite: { plugins: [tailwindcss()] },
});`,
    );
  }
}

async function ensureAstroStyleImport(pagePath: string, importPath: string): Promise<void> {
  const source = await readFile(pagePath, "utf8");
  if (source.includes(importPath)) return;
  const statement = `import "${importPath}";`;
  const next = source.startsWith("---\n")
    ? source.replace("---\n", `---\n${statement}\n`)
    : `---\n${statement}\n---\n${source}`;
  await writeText(pagePath, next);
}

async function configureMonorepo(
  root: string,
  framework: FrontendFramework,
  system: Exclude<StylingSystem, "none">,
): Promise<void> {
  const appRoot = join(root, "apps/web");
  const uiRoot = join(root, "packages/ui");

  await updatePackageJson(join(appRoot, "package.json"), (packageJson) =>
    mergeSection(packageJson, "dependencies", { "@workspace/ui": "workspace:*" }));
  await updatePackageJson(join(uiRoot, "package.json"), (packageJson) => {
    let next: JsonRecord = {
      ...packageJson,
      exports: system === "shadcn"
        ? {
            ".": "./src/index.ts",
            "./globals.css": "./src/styles/globals.css",
            "./components/*": "./src/components/*.tsx",
            "./lib/*": "./src/lib/*.ts",
            "./hooks/*": "./src/hooks/*.ts",
          }
        : { ".": "./src/index.ts", "./styles.css": "./src/styles.css" },
    };
    if (system === "bootstrap") {
      next = mergeSection(next, "dependencies", { bootstrap: "latest" });
    } else {
      next = mergeSection(next, "devDependencies", {
        tailwindcss: "latest",
        ...(system === "daisyui" ? { daisyui: "latest" } : {}),
      });
    }
    if (system === "shadcn") {
      next = mergeSection(next, "dependencies", {
        "class-variance-authority": "latest",
        clsx: "latest",
        "lucide-react": "latest",
        shadcn: "latest",
        "tailwind-merge": "latest",
        "tw-animate-css": "latest",
      });
    }
    return next;
  });

  if (system === "shadcn") {
    await writeText(join(uiRoot, "src/styles/globals.css"), cssContents(system, true));
    await writeText(
      join(uiRoot, "src/lib/utils.ts"),
      `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}`,
    );
    await writeText(join(uiRoot, "src/index.ts"), 'export { cn } from "./lib/utils.js";');
    await writeJson(join(uiRoot, "components.json"), shadcnConfig("src/styles/globals.css", framework, true));
    await writeJson(
      join(appRoot, "components.json"),
      {
        ...shadcnConfig("../../packages/ui/src/styles/globals.css", framework, true),
        aliases: {
          components: "@/components",
          hooks: "@/hooks",
          lib: "@/lib",
          utils: "@workspace/ui/lib/utils",
          ui: "@workspace/ui/components",
        },
      },
    );
    await configureSourceAlias(appRoot, framework, true);
  } else {
    await writeText(join(uiRoot, "src/styles.css"), cssContents(system, true));
  }

  if (usesTailwind(system)) await configureTailwindAdapter(appRoot, framework, system === "shadcn");

  const styleImport = system === "shadcn" ? "@workspace/ui/globals.css" : "@workspace/ui/styles.css";
  if (framework === "vite") {
    await writeText(join(appRoot, "src/style.css"), `@import "${styleImport}";`);
  } else if (framework === "next") {
    await writeText(
      join(appRoot, "app/layout.tsx"),
      `import "${styleImport}";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}`,
    );
  } else {
    await ensureAstroStyleImport(join(appRoot, "src/pages/index.astro"), styleImport);
  }
}

async function configureStandard(
  root: string,
  framework: FrontendFramework,
  system: Exclude<StylingSystem, "none">,
): Promise<void> {
  await updatePackageJson(join(root, "package.json"), (packageJson) => {
    if (system === "bootstrap") return mergeSection(packageJson, "dependencies", { bootstrap: "latest" });
    let next = mergeSection(packageJson, "devDependencies", {
      tailwindcss: "latest",
      ...(system === "daisyui" ? { daisyui: "latest" } : {}),
    });
    if (system === "shadcn") {
      next = mergeSection(next, "dependencies", {
        "class-variance-authority": "latest",
        clsx: "latest",
        "lucide-react": "latest",
        shadcn: "latest",
        "tailwind-merge": "latest",
        "tw-animate-css": "latest",
      });
    }
    return next;
  });

  if (usesTailwind(system)) await configureTailwindAdapter(root, framework, system === "shadcn");

  const cssPath = framework === "next"
    ? "src/app/globals.css"
    : framework === "vite"
      ? "src/index.css"
      : "src/styles/globals.css";
  await writeText(join(root, cssPath), cssContents(system, false));

  if (framework === "astro") await ensureAstroStyleImport(join(root, "src/pages/index.astro"), "../styles/globals.css");

  if (system === "shadcn") {
    await writeText(
      join(root, "src/lib/utils.ts"),
      `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}`,
    );
    await writeJson(join(root, "components.json"), shadcnConfig(cssPath, framework, false));
    await configureSourceAlias(root, framework, false);
  }
}

export async function configureStyling(root: string, answers: Answers): Promise<void> {
  const framework = frontendFramework(answers);
  const system = answers.styling ?? "none";
  if (!framework || system === "none") return;
  if (answers.mode === "monorepo") await configureMonorepo(root, framework, system);
  else await configureStandard(root, framework, system);
}

export function getStylingLabel(system: StylingSystem | undefined): string {
  return stylingLabel[system ?? "none"];
}
