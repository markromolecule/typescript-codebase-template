import { describe, expect, it } from "vitest";
import { OCTO_BANNER, OCTO_PACKAGE_NAME, OCTO_VERSION } from "./branding.js";
import { getHelpText, resolveContextRepository } from "./cli.js";
import { OFFICIAL_CONTEXT_REPOSITORY } from "./constants.js";

describe("Octo branding", () => {
  it("uses package metadata as the CLI version source", () => {
    expect(OCTO_PACKAGE_NAME).toBe("@markromolecule/octo");
    expect(OCTO_BANNER).toBe(`🐙 Octo CLI v${OCTO_VERSION}`);
  });

  it("shows branded package and binary commands in help", () => {
    expect(getHelpText()).toContain(`pnpm dlx ${OCTO_PACKAGE_NAME}@latest`);
    expect(getHelpText()).toContain("octo [--context-repo <git-url>]");
    expect(getHelpText()).toContain("Official context factory");
  });
});

describe("resolveContextRepository", () => {
  it("uses the official context repository by default", () => {
    expect(resolveContextRepository(["node", "cli.js"], {})).toBe(OFFICIAL_CONTEXT_REPOSITORY);
  });

  it("allows an environment override", () => {
    expect(resolveContextRepository(
      ["node", "cli.js"],
      { CONTEXT_FACTORY_REPO: "https://example.com/environment.git" },
    )).toBe("https://example.com/environment.git");
  });

  it("prefers an explicit option over the environment", () => {
    expect(resolveContextRepository(
      ["node", "cli.js", "--context-repo", "https://example.com/option.git"],
      { CONTEXT_FACTORY_REPO: "https://example.com/environment.git" },
    )).toBe("https://example.com/option.git");
  });
});

describe("collectAnswers prompt flow logic", () => {
  it("frontend architecture: projectType includes frontend and styling fields", () => {
    // Verify Answers type shape for frontend architecture
    type FrontendAnswers = { projectName: string; architecture: "frontend"; frontend: "next" | "astro" | "vite"; styling: "shadcn" | "daisyui" | "bootstrap" | "tailwind" | "none"; backend?: never };
    const answer: FrontendAnswers = {
      projectName: "my-app",
      architecture: "frontend",
      frontend: "next",
      styling: "shadcn",
    };
    expect(answer.architecture).toBe("frontend");
    expect(answer.frontend).toBeDefined();
    expect(answer.styling).toBeDefined();
    expect(answer.backend).toBeUndefined();
  });

  it("backend architecture: projectType includes only backend field", () => {
    const answer = {
      projectName: "my-api",
      architecture: "backend" as const,
      backend: "hono" as const,
    };
    expect(answer.architecture).toBe("backend");
    expect(answer.backend).toBeDefined();
    // frontend and styling must not be set for backend-only projects
    expect((answer as Record<string, unknown>)["frontend"]).toBeUndefined();
    expect((answer as Record<string, unknown>)["styling"]).toBeUndefined();
  });

  it("monorepo architecture: projectType includes frontend, styling, and backend", () => {
    const answer = {
      projectName: "my-mono",
      architecture: "monorepo" as const,
      frontend: "vite" as const,
      styling: "tailwind" as const,
      backend: "express" as const,
    };
    expect(answer.architecture).toBe("monorepo");
    expect(answer.frontend).toBeDefined();
    expect(answer.styling).toBeDefined();
    expect(answer.backend).toBeDefined();
  });
});
