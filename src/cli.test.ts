import { describe, expect, it } from "vitest";
import { OCTO_BANNER, OCTO_PACKAGE_NAME, OCTO_VERSION } from "./branding.js";
import { getHelpText, resolveContextRepository } from "./cli.js";

describe("Octo branding", () => {
  it("uses package metadata as the CLI version source", () => {
    expect(OCTO_PACKAGE_NAME).toBe("@markromolecule/octo");
    expect(OCTO_BANNER).toBe(`🐙 Octo CLI v${OCTO_VERSION}`);
  });

  it("shows branded package and binary commands in help", () => {
    expect(getHelpText()).toContain(`pnpm dlx ${OCTO_PACKAGE_NAME}@latest`);
    expect(getHelpText()).toContain("octo [--context-repo <git-url>]");
    expect(getHelpText()).toContain("Included in the published package");
  });
});

describe("resolveContextRepository", () => {
  it("uses the bundled context factory by default", () => {
    expect(resolveContextRepository(["node", "cli.js"], {})).toBeUndefined();
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
