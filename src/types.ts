export type StructureMode = "monorepo" | "standard";
export type FrontendFramework = "vite" | "next" | "astro";
export type BackendFramework = "hono" | "express";
export type Framework = FrontendFramework | BackendFramework;
export type ContextSyncMethod = "bundled" | "submodule" | "standalone";

export interface Answers {
  projectName: string;
  mode: StructureMode;
  frontend?: FrontendFramework;
  backend?: BackendFramework;
  framework?: Framework;
  contextSync: ContextSyncMethod;
}

export interface ScaffoldOptions {
  cwd: string;
  contextRepository?: string;
  run?: (command: string, args: string[], cwd: string) => Promise<void>;
}
