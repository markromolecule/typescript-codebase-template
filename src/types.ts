export type ProjectArchitecture = "frontend" | "backend" | "monorepo";
export type FrontendFramework = "vite" | "next" | "astro";
export type BackendFramework = "hono" | "express";
export type Framework = FrontendFramework | BackendFramework;
export type StylingSystem = "none" | "shadcn" | "daisyui" | "bootstrap" | "tailwind";

/** @deprecated Use `architecture` field instead of `mode`. Kept for transition compatibility. */
export type StructureMode = "monorepo" | "standard";

export interface Answers {
  projectName: string;
  architecture: ProjectArchitecture;
  /** Populated when architecture is "frontend" or "monorepo". */
  frontend?: FrontendFramework;
  /** Populated when architecture is "backend" or "monorepo". */
  backend?: BackendFramework;
  /** Populated when architecture is "frontend" or "monorepo" and a frontend framework is selected. */
  styling?: StylingSystem;
  /** @deprecated Legacy field kept during transition. Use architecture instead. */
  mode?: StructureMode;
  /** @deprecated Legacy field kept during transition. Use frontend or backend directly. */
  framework?: Framework;
}

export interface ScaffoldOptions {
  cwd: string;
  contextRepository?: string;
  run?: (command: string, args: string[], cwd: string) => Promise<void>;
}
