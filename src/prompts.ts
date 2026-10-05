import * as p from "@clack/prompts";
import { OCTO_BANNER } from "./branding.js";
import { PROJECT_NAME_PATTERN } from "./constants.js";
import type {
  Answers,
  BackendFramework,
  FrontendFramework,
  ProjectArchitecture,
  StylingSystem,
} from "./types.js";

function requireValue<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Scaffolding cancelled.");
    process.exit(0);
  }
  return value as T;
}

async function promptFrontendFramework(): Promise<FrontendFramework> {
  return requireValue<FrontendFramework>(
    await p.select({
      message: "Frontend framework",
      options: [
        { value: "next", label: "Next.js", hint: "React framework with SSR, RSC, and App Router" },
        { value: "astro", label: "Astro", hint: "Content-first framework with island architecture" },
        { value: "vite", label: "React + Vite", hint: "Fast SPA with Vite and React" },
      ],
    }),
  );
}

async function promptStyling(): Promise<StylingSystem> {
  return requireValue<StylingSystem>(
    await p.select({
      message: "Styling and component system",
      options: [
        { value: "shadcn", label: "shadcn/ui", hint: "Tailwind-based editable components" },
        { value: "daisyui", label: "daisyUI", hint: "Tailwind component classes and themes" },
        { value: "bootstrap", label: "Bootstrap", hint: "Components, utilities, and CSS variables" },
        { value: "tailwind", label: "Tailwind CSS", hint: "Utilities without a component library" },
        { value: "none", label: "None / framework default" },
      ],
    }),
  );
}

async function promptBackendFramework(): Promise<BackendFramework> {
  return requireValue<BackendFramework>(
    await p.select({
      message: "Backend framework",
      options: [
        { value: "hono", label: "Hono", hint: "Lightweight TypeScript-first web framework" },
        { value: "express", label: "Express", hint: "Minimal and flexible Node.js framework" },
      ],
    }),
  );
}

export async function collectAnswers(): Promise<Answers> {
  p.intro(OCTO_BANNER);

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

  const architecture = requireValue<ProjectArchitecture>(
    await p.select({
      message: "What are you building?",
      options: [
        {
          value: "frontend",
          label: "Frontend Web App",
          hint: "Next.js, Astro, or React + Vite — no backend",
        },
        {
          value: "backend",
          label: "Backend API",
          hint: "Hono or Express — server only",
        },
        {
          value: "monorepo",
          label: "Fullstack Monorepo",
          hint: "Web app + API + shared packages (Turborepo)",
        },
      ],
    }),
  );

  if (architecture === "frontend") {
    const frontend = await promptFrontendFramework();
    const styling = await promptStyling();
    return { projectName, architecture, frontend, styling };
  }

  if (architecture === "backend") {
    const backend = await promptBackendFramework();
    return { projectName, architecture, backend };
  }

  // monorepo: frontend + styling + backend
  const frontend = await promptFrontendFramework();
  const styling = await promptStyling();
  const backend = await promptBackendFramework();
  return { projectName, architecture, frontend, styling, backend };
}
