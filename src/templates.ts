import { join } from "node:path";
import { writeJson, writeText } from "./files.js";
import type { BackendFramework, FrontendFramework, Framework } from "./types.js";

const baseTsconfig = {
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    module: "ESNext",
    moduleResolution: "Bundler",
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    isolatedModules: true,
  },
};

export async function createFrontend(root: string, framework: FrontendFramework): Promise<void> {
  const dir = join(root, "apps/web");
  if (framework === "vite") {
    await writeJson(join(dir, "package.json"), {
      name: "@workspace/web",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: { dev: "vite", build: "tsc -b && vite build", lint: "eslint ." },
      dependencies: { "@vitejs/plugin-react": "latest", vite: "latest", react: "latest", "react-dom": "latest" },
      devDependencies: { "@types/react": "latest", "@types/react-dom": "latest", "@workspace/tsconfig": "workspace:*", typescript: "^5.9.3" },
    });
    await writeJson(join(dir, "tsconfig.json"), {
      extends: "@workspace/tsconfig/react.json",
      compilerOptions: { jsx: "react-jsx", noEmit: true },
      include: ["src", "vite.config.ts"],
    });
    await writeText(join(dir, "index.html"), '<div id="root"></div><script type="module" src="/src/main.tsx"></script>');
    await writeText(join(dir, "vite.config.ts"), 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({ plugins: [react()] });');
    await writeText(join(dir, "src/main.tsx"), 'import React from "react";\nimport { createRoot } from "react-dom/client";\nimport "./style.css";\n\ncreateRoot(document.getElementById("root")!).render(<React.StrictMode><main><h1>React + Vite</h1><p>Your monorepo is ready.</p></main></React.StrictMode>);');
    await writeText(join(dir, "src/style.css"), ':root { font-family: system-ui, sans-serif; color-scheme: light dark; } body { margin: 0; } main { max-width: 48rem; margin: 5rem auto; padding: 2rem; }');
    return;
  }
  if (framework === "next") {
    await writeJson(join(dir, "package.json"), {
      name: "@workspace/web",
      private: true,
      version: "0.0.0",
      scripts: { dev: "next dev", build: "next build", start: "next start", lint: "eslint ." },
      dependencies: { next: "latest", react: "latest", "react-dom": "latest" },
      devDependencies: { "@types/node": "latest", "@types/react": "latest", "@types/react-dom": "latest", "@workspace/tsconfig": "workspace:*", typescript: "^5.9.3" },
    });
    await writeJson(join(dir, "tsconfig.json"), {
      extends: "@workspace/tsconfig/react.json",
      compilerOptions: { jsx: "preserve", noEmit: true, plugins: [{ name: "next" }] },
      include: ["next-env.d.ts", ".next/types/**/*.ts", "**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    });
    await writeText(join(dir, "next-env.d.ts"), '/// <reference types="next" />\n/// <reference types="next/image-types/global" />');
    await writeText(join(dir, "next.config.ts"), 'import type { NextConfig } from "next";\nconst config: NextConfig = { transpilePackages: ["@workspace/ui"] };\nexport default config;');
    await writeText(join(dir, "app/layout.tsx"), 'import type { ReactNode } from "react";\nexport default function Layout({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html>; }');
    await writeText(join(dir, "app/page.tsx"), 'export default function Page() { return <main><h1>Next.js</h1><p>Your monorepo is ready.</p></main>; }');
    return;
  }
  await writeJson(join(dir, "package.json"), {
    name: "@workspace/web",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: { dev: "astro dev", build: "astro build", preview: "astro preview" },
    dependencies: { astro: "latest" },
    devDependencies: { typescript: "^5.9.3" },
  });
  await writeJson(join(dir, "tsconfig.json"), { extends: "astro/tsconfigs/strict" });
  await writeText(join(dir, "src/pages/index.astro"), '---\nconst title = "Astro";\n---\n<html lang="en"><head><meta charset="utf-8" /><title>{title}</title></head><body><main><h1>{title}</h1><p>Your monorepo is ready.</p></main></body></html>');
}

export async function createBackend(root: string, framework: BackendFramework): Promise<void> {
  const dir = join(root, "apps/api");
  const isHono = framework === "hono";
  await writeJson(join(dir, "package.json"), {
    name: "@workspace/api",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: { dev: "tsx watch src/index.ts", build: "tsc -p tsconfig.json", start: "node dist/index.js" },
    dependencies: isHono ? { "@hono/node-server": "latest", "@workspace/db": "workspace:*", hono: "latest" } : { "@workspace/db": "workspace:*", express: "latest" },
    devDependencies: isHono ? { "@types/node": "latest", "@workspace/tsconfig": "workspace:*", tsx: "latest", typescript: "^5.9.3" } : { "@types/express": "latest", "@types/node": "latest", "@workspace/tsconfig": "workspace:*", tsx: "latest", typescript: "^5.9.3" },
  });
  await writeJson(join(dir, "tsconfig.json"), {
    extends: "@workspace/tsconfig/base.json",
    compilerOptions: { outDir: "dist", rootDir: "src", types: ["node"] },
    include: ["src/**/*.ts"],
  });
  const source = isHono
    ? 'import { serve } from "@hono/node-server";\nimport { Hono } from "hono";\n\nconst app = new Hono();\napp.get("/", (c) => c.json({ ok: true, framework: "hono" }));\nserve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3001) });\n'
    : 'import express from "express";\n\nconst app = express();\napp.use(express.json());\napp.get("/", (_request, response) => response.json({ ok: true, framework: "express" }));\napp.listen(Number(process.env.PORT ?? 3001));\n';
  await writeText(join(dir, "src/index.ts"), source);
}

export async function createSharedPackages(root: string): Promise<void> {
  const packages = ["ui", "hooks", "services", "shared"] as const;
  for (const name of packages) {
    await writeJson(join(root, `packages/${name}/package.json`), {
      name: `@workspace/${name}`,
      version: "0.0.0",
      private: true,
      type: "module",
      exports: { ".": "./src/index.ts" },
      scripts: { build: "tsc -p tsconfig.json" },
      devDependencies: { "@workspace/tsconfig": "workspace:*", typescript: "^5.9.3" },
    });
    await writeJson(join(root, `packages/${name}/tsconfig.json`), {
      extends: "@workspace/tsconfig/base.json",
      compilerOptions: { outDir: "dist", rootDir: "src" },
      include: ["src/**/*.ts"],
    });
    await writeText(join(root, `packages/${name}/src/index.ts`), `export const packageName = "@workspace/${name}";`);
  }

  await writeJson(join(root, "packages/tsconfig/package.json"), {
    name: "@workspace/tsconfig",
    version: "0.0.0",
    private: true,
    files: ["base.json", "react.json"],
  });
  await writeJson(join(root, "packages/tsconfig/base.json"), baseTsconfig);
  await writeJson(join(root, "packages/tsconfig/react.json"), {
    extends: "./base.json",
    compilerOptions: { jsx: "react-jsx" },
  });

  await writeJson(join(root, "packages/eslint-config/package.json"), {
    name: "@workspace/eslint-config",
    version: "0.0.0",
    private: true,
    type: "module",
    exports: { ".": "./index.js" },
    dependencies: { "@eslint/js": "latest", "typescript-eslint": "latest" },
  });
  await writeText(join(root, "packages/eslint-config/index.js"), 'import eslint from "@eslint/js";\nimport tseslint from "typescript-eslint";\nexport default tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommended);');
}

export async function createDatabase(root: string): Promise<void> {
  const dir = join(root, "packages/db");
  await writeJson(join(dir, "package.json"), {
    name: "@workspace/db",
    version: "0.0.0",
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: { "db:generate": "prisma generate", "db:migrate": "prisma migrate dev", build: "tsc -p tsconfig.json" },
    dependencies: { kysely: "latest", pg: "latest" },
    devDependencies: { "@types/node": "latest", "@types/pg": "latest", "@workspace/tsconfig": "workspace:*", prisma: "latest", "prisma-kysely": "latest", typescript: "^5.9.3" },
  });
  await writeJson(join(dir, "tsconfig.json"), {
    extends: "@workspace/tsconfig/base.json",
    compilerOptions: { outDir: "dist", rootDir: "src", types: ["node"] },
    include: ["src/**/*.ts"],
  });
  await writeText(join(dir, "prisma/schema.prisma"), 'generator kysely {\n  provider = "prisma-kysely"\n  output   = "../src/generated"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\nmodel User {\n  id        String   @id @default(cuid())\n  email     String   @unique\n  name      String?\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}');
  await writeText(join(dir, "prisma.config.ts"), 'import { defineConfig } from "prisma/config";\n\nexport default defineConfig({\n  schema: "prisma/schema.prisma",\n  migrations: { path: "prisma/migrations" },\n  datasource: {\n    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/app",\n  },\n});');
  await writeText(join(dir, "src/index.ts"), 'import { Kysely, PostgresDialect } from "kysely";\nimport pg from "pg";\nimport type { DB } from "./generated/types.js";\n\nexport type { DB } from "./generated/types.js";\n\nconst pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });\nexport const db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });');
  await writeText(join(dir, "src/generated/types.ts"), '// Replaced by `pnpm db:generate`.\nexport interface DB {}');
}

export async function createMinimalStandard(root: string, framework: Extract<Framework, "hono" | "express">): Promise<void> {
  const isHono = framework === "hono";
  await writeJson(join(root, "package.json"), {
    name: root.split(/[\\/]/).pop(),
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: { dev: "tsx watch src/index.ts", build: "tsc", start: "node dist/index.js" },
    dependencies: isHono ? { "@hono/node-server": "latest", hono: "latest" } : { express: "latest" },
    devDependencies: isHono ? { "@types/node": "latest", tsx: "latest", typescript: "^5.9.3" } : { "@types/express": "latest", "@types/node": "latest", tsx: "latest", typescript: "^5.9.3" },
  });
  await writeJson(join(root, "tsconfig.json"), {
    compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", rootDir: "src", outDir: "dist", types: ["node"], strict: true, esModuleInterop: true, skipLibCheck: true },
    include: ["src/**/*.ts"],
  });
  await writeText(join(root, "src/index.ts"), isHono
    ? 'import { serve } from "@hono/node-server";\nimport { Hono } from "hono";\nconst app = new Hono();\napp.get("/", (c) => c.json({ ok: true }));\nserve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });'
    : 'import express from "express";\nconst app = express();\napp.get("/", (_req, res) => res.json({ ok: true }));\napp.listen(Number(process.env.PORT ?? 3000));');
}
