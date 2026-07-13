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

async function createBackendModule(root: string, framework: BackendFramework): Promise<void> {
  const moduleRoot = join(root, "src/modules/sample");
  const commonFiles: Record<string, string> = {
    "dto/sample.dto.ts": `import { z } from "zod";

export const createSampleDtoSchema = z.object({
  name: z.string().trim().min(1).max(120),
}).strict();

export const updateSampleDtoSchema = createSampleDtoSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required." },
);

export type CreateSampleDto = z.infer<typeof createSampleDtoSchema>;
export type UpdateSampleDto = z.infer<typeof updateSampleDtoSchema>;`,
    "data/sample.data.ts": `export interface Sample {
  id: string;
  name: string;
}

export type SampleStore = Map<string, Sample>;`,
    "data/create-sample.data.ts": `import type { Sample, SampleStore } from "./sample.data.js";

export function createSampleData(store: SampleStore, input: Pick<Sample, "name">): Sample {
  const sample = { id: crypto.randomUUID(), ...input };
  store.set(sample.id, sample);
  return sample;
}`,
    "data/update-sample.data.ts": `import type { Sample, SampleStore } from "./sample.data.js";

export function updateSampleData(
  store: SampleStore,
  id: string,
  input: Partial<Pick<Sample, "name">>,
): Sample | undefined {
  const existing = store.get(id);
  if (!existing) return undefined;
  const sample = { ...existing, ...input };
  store.set(id, sample);
  return sample;
}`,
    "data/delete-sample.data.ts": `import type { SampleStore } from "./sample.data.js";

export function deleteSampleData(store: SampleStore, id: string): boolean {
  return store.delete(id);
}`,
    "services/create-sample.service.ts": `import { createSampleData } from "../data/create-sample.data.js";
import type { Sample, SampleStore } from "../data/sample.data.js";
import type { CreateSampleDto } from "../dto/sample.dto.js";

export function createSampleService(store: SampleStore, input: CreateSampleDto): Sample {
  return createSampleData(store, input);
}`,
    "services/update-sample.service.ts": `import type { Sample, SampleStore } from "../data/sample.data.js";
import { updateSampleData } from "../data/update-sample.data.js";
import type { UpdateSampleDto } from "../dto/sample.dto.js";

export function updateSampleService(
  store: SampleStore,
  id: string,
  input: UpdateSampleDto,
): Sample | undefined {
  return updateSampleData(store, id, input);
}`,
    "services/delete-sample.service.ts": `import { deleteSampleData } from "../data/delete-sample.data.js";
import type { SampleStore } from "../data/sample.data.js";

export function deleteSampleService(store: SampleStore, id: string): boolean {
  return deleteSampleData(store, id);
}`,
  };

  const controllerFiles = framework === "hono" ? {
    "controllers/create-sample.controller.ts": `import type { Context } from "hono";
import type { SampleStore } from "../data/sample.data.js";
import { createSampleDtoSchema } from "../dto/sample.dto.js";
import { createSampleService } from "../services/create-sample.service.js";

export async function createSampleController(context: Context, store: SampleStore): Promise<Response> {
  const parsed = createSampleDtoSchema.safeParse(await context.req.json().catch(() => undefined));
  if (!parsed.success) {
    return context.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body." } }, 400);
  }
  return context.json({ data: createSampleService(store, parsed.data) }, 201);
}`,
    "controllers/update-sample.controller.ts": `import type { Context } from "hono";
import type { SampleStore } from "../data/sample.data.js";
import { updateSampleDtoSchema } from "../dto/sample.dto.js";
import { updateSampleService } from "../services/update-sample.service.js";

export async function updateSampleController(context: Context, store: SampleStore): Promise<Response> {
  const parsed = updateSampleDtoSchema.safeParse(await context.req.json().catch(() => undefined));
  if (!parsed.success) {
    return context.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body." } }, 400);
  }
  const sample = updateSampleService(store, context.req.param("id"), parsed.data);
  if (!sample) return context.json({ error: { code: "NOT_FOUND", message: "Sample not found." } }, 404);
  return context.json({ data: sample });
}`,
    "controllers/delete-sample.controller.ts": `import type { Context } from "hono";
import type { SampleStore } from "../data/sample.data.js";
import { deleteSampleService } from "../services/delete-sample.service.js";

export function deleteSampleController(context: Context, store: SampleStore): Response {
  if (!deleteSampleService(store, context.req.param("id"))) {
    return context.json({ error: { code: "NOT_FOUND", message: "Sample not found." } }, 404);
  }
  return context.body(null, 204);
}`,
    "sample.routes.ts": `import { Hono } from "hono";
import { createSampleController } from "./controllers/create-sample.controller.js";
import { deleteSampleController } from "./controllers/delete-sample.controller.js";
import { updateSampleController } from "./controllers/update-sample.controller.js";
import type { SampleStore } from "./data/sample.data.js";

export function createSampleRoutes(store: SampleStore): Hono {
  return new Hono()
    .post("/", (context) => createSampleController(context, store))
    .patch("/:id", (context) => updateSampleController(context, store))
    .delete("/:id", (context) => deleteSampleController(context, store));
}`,
  } : {
    "controllers/create-sample.controller.ts": `import type { Request, Response } from "express";
import type { SampleStore } from "../data/sample.data.js";
import { createSampleDtoSchema } from "../dto/sample.dto.js";
import { createSampleService } from "../services/create-sample.service.js";

export function createSampleController(request: Request, response: Response, store: SampleStore): Response {
  const parsed = createSampleDtoSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body." } });
  }
  return response.status(201).json({ data: createSampleService(store, parsed.data) });
}`,
    "controllers/update-sample.controller.ts": `import type { Request, Response } from "express";
import type { SampleStore } from "../data/sample.data.js";
import { updateSampleDtoSchema } from "../dto/sample.dto.js";
import { updateSampleService } from "../services/update-sample.service.js";

export function updateSampleController(request: Request, response: Response, store: SampleStore): Response {
  const parsed = updateSampleDtoSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body." } });
  }
  const sample = updateSampleService(store, request.params.id, parsed.data);
  if (!sample) return response.status(404).json({ error: { code: "NOT_FOUND", message: "Sample not found." } });
  return response.json({ data: sample });
}`,
    "controllers/delete-sample.controller.ts": `import type { Request, Response } from "express";
import type { SampleStore } from "../data/sample.data.js";
import { deleteSampleService } from "../services/delete-sample.service.js";

export function deleteSampleController(request: Request, response: Response, store: SampleStore): Response {
  if (!deleteSampleService(store, request.params.id)) {
    return response.status(404).json({ error: { code: "NOT_FOUND", message: "Sample not found." } });
  }
  return response.status(204).send();
}`,
    "sample.routes.ts": `import { Router } from "express";
import { createSampleController } from "./controllers/create-sample.controller.js";
import { deleteSampleController } from "./controllers/delete-sample.controller.js";
import { updateSampleController } from "./controllers/update-sample.controller.js";
import type { SampleStore } from "./data/sample.data.js";

export function createSampleRoutes(store: SampleStore): Router {
  const routes = Router();

  routes.post("/", (request, response) => createSampleController(request, response, store));
  routes.patch("/:id", (request, response) => updateSampleController(request, response, store));
  routes.delete("/:id", (request, response) => deleteSampleController(request, response, store));
  return routes;
}`,
  };

  await Promise.all(Object.entries({ ...commonFiles, ...controllerFiles }).map(async ([path, contents]) => {
    await writeText(join(moduleRoot, path), contents);
  }));
}

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
    dependencies: isHono ? { "@hono/node-server": "latest", "@workspace/db": "workspace:*", hono: "latest", zod: "latest" } : { "@workspace/db": "workspace:*", express: "latest", zod: "latest" },
    devDependencies: isHono ? { "@types/node": "latest", "@workspace/tsconfig": "workspace:*", tsx: "latest", typescript: "^5.9.3" } : { "@types/express": "latest", "@types/node": "latest", "@workspace/tsconfig": "workspace:*", tsx: "latest", typescript: "^5.9.3" },
  });
  await writeJson(join(dir, "tsconfig.json"), {
    extends: "@workspace/tsconfig/base.json",
    compilerOptions: { outDir: "dist", rootDir: "src", types: ["node"] },
    include: ["src/**/*.ts"],
  });
  const source = isHono
    ? 'import { serve } from "@hono/node-server";\nimport { Hono } from "hono";\nimport { bodyLimit } from "hono/body-limit";\nimport type { Sample } from "./modules/sample/data/sample.data.js";\nimport { createSampleRoutes } from "./modules/sample/sample.routes.js";\n\nconst app = new Hono();\nconst sampleStore = new Map<string, Sample>();\napp.use("*", bodyLimit({ maxSize: 100 * 1024, onError: (context) => context.json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large." } }, 413) }));\napp.get("/", (context) => context.json({ ok: true, framework: "hono" }));\napp.route("/samples", createSampleRoutes(sampleStore));\nserve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3001) });\n'
    : 'import express from "express";\nimport type { Sample } from "./modules/sample/data/sample.data.js";\nimport { createSampleRoutes } from "./modules/sample/sample.routes.js";\n\nconst app = express();\nconst sampleStore = new Map<string, Sample>();\napp.disable("x-powered-by");\napp.use(express.json({ limit: "100kb" }));\napp.get("/", (_request, response) => response.json({ ok: true, framework: "express" }));\napp.use("/samples", createSampleRoutes(sampleStore));\napp.use((_error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {\n  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });\n});\napp.listen(Number(process.env.PORT ?? 3001));\n';
  await writeText(join(dir, "src/index.ts"), source);
  await createBackendModule(dir, framework);
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

  const sharedSourceDirectories = ["schemas", "types", "utils", "constants"] as const;
  await Promise.all(sharedSourceDirectories.map(async (directory) => {
    await writeText(join(root, `packages/shared/src/${directory}/index.ts`), "export {};");
  }));
  await writeText(
    join(root, "packages/shared/src/index.ts"),
    `export const packageName = "@workspace/shared";

export * from "./schemas/index.js";
export * from "./types/index.js";
export * from "./utils/index.js";
export * from "./constants/index.js";`,
  );

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
    dependencies: isHono ? { "@hono/node-server": "latest", hono: "latest", zod: "latest" } : { express: "latest", zod: "latest" },
    devDependencies: isHono ? { "@types/node": "latest", tsx: "latest", typescript: "^5.9.3" } : { "@types/express": "latest", "@types/node": "latest", tsx: "latest", typescript: "^5.9.3" },
  });
  await writeJson(join(root, "tsconfig.json"), {
    compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", rootDir: "src", outDir: "dist", types: ["node"], strict: true, esModuleInterop: true, skipLibCheck: true },
    include: ["src/**/*.ts"],
  });
  await writeText(join(root, "src/index.ts"), isHono
    ? 'import { serve } from "@hono/node-server";\nimport { Hono } from "hono";\nimport { bodyLimit } from "hono/body-limit";\nimport type { Sample } from "./modules/sample/data/sample.data.js";\nimport { createSampleRoutes } from "./modules/sample/sample.routes.js";\n\nconst app = new Hono();\nconst sampleStore = new Map<string, Sample>();\napp.use("*", bodyLimit({ maxSize: 100 * 1024, onError: (context) => context.json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large." } }, 413) }));\napp.get("/", (context) => context.json({ ok: true }));\napp.route("/samples", createSampleRoutes(sampleStore));\nserve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });'
    : 'import express from "express";\nimport type { Sample } from "./modules/sample/data/sample.data.js";\nimport { createSampleRoutes } from "./modules/sample/sample.routes.js";\n\nconst app = express();\nconst sampleStore = new Map<string, Sample>();\napp.disable("x-powered-by");\napp.use(express.json({ limit: "100kb" }));\napp.get("/", (_request, response) => response.json({ ok: true }));\napp.use("/samples", createSampleRoutes(sampleStore));\napp.use((_error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {\n  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });\n});\napp.listen(Number(process.env.PORT ?? 3000));');
  await createBackendModule(root, framework);
}
