import { describe, expect, it } from "vitest";
import { DEFAULT_CONTEXT_REPOSITORY } from "./constants.js";
import { resolveContextRepository } from "./cli.js";

describe("resolveContextRepository", () => {
  it("uses the official context factory by default", () => {
    expect(resolveContextRepository(["node", "cli.js"], {})).toBe(DEFAULT_CONTEXT_REPOSITORY);
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
