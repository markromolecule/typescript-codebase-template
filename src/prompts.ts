import * as p from "@clack/prompts";
import { PROJECT_NAME_PATTERN } from "./constants.js";
import type {
  Answers,
  BackendFramework,
  ContextSyncMethod,
  Framework,
  FrontendFramework,
  StructureMode,
} from "./types.js";

function requireValue<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Scaffolding cancelled.");
    process.exit(0);
  }
  return value as T;
}

export async function collectAnswers(): Promise<Answers> {
  p.intro("create-monorepo-template");
  const projectName = requireValue(
    await p.text({
      message: "Project name",
      placeholder: "my-project",
      validate(value) {
        if (!value) return "Enter a project name.";
        if (!PROJECT_NAME_PATTERN.test(value)) {
          return "Use lowercase letters, numbers, dots, hyphens, or underscores.";
        }
      },
    }),
  );
  const mode = requireValue<StructureMode>(
    await p.select({
      message: "Project structure",
      options: [
        { value: "monorepo", label: "Monorepo" },
        { value: "standard", label: "Standard" },
      ],
    }),
  );

  let frontend: FrontendFramework | undefined;
  let backend: BackendFramework | undefined;
  let framework: Framework | undefined;
  if (mode === "monorepo") {
    frontend = requireValue<FrontendFramework>(
      await p.select({
        message: "Frontend framework",
        options: [
          { value: "vite", label: "React + Vite" },
          { value: "next", label: "Next.js" },
          { value: "astro", label: "Astro" },
        ],
      }),
    );
    backend = requireValue<BackendFramework>(
      await p.select({
        message: "Backend framework",
        options: [
          { value: "hono", label: "Hono" },
          { value: "express", label: "Express" },
        ],
      }),
    );
  } else {
    framework = requireValue<Framework>(
      await p.select({
        message: "Framework",
        options: [
          { value: "vite", label: "React + Vite" },
          { value: "next", label: "Next.js" },
          { value: "astro", label: "Astro" },
          { value: "hono", label: "Hono" },
          { value: "express", label: "Express" },
        ],
      }),
    );
  }
  const contextSync = requireValue<ContextSyncMethod>(
    await p.select({
      message: "Context-factory sync",
      options: [
        { value: "submodule", label: "Git Submodule" },
        { value: "standalone", label: "Direct Clone (Standalone)" },
      ],
    }),
  );
  return { projectName, mode, frontend, backend, framework, contextSync };
}
