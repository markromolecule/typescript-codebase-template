#!/usr/bin/env node
import * as p from "@clack/prompts";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONTEXT_REPOSITORY } from "./constants.js";
import { collectAnswers } from "./prompts.js";
import { scaffoldProject } from "./scaffold.js";

function optionValue(name: string, argv: string[]): string | undefined {
  const equals = argv.find((argument) => argument.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function resolveContextRepository(
  argv: string[] = process.argv,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return optionValue("--context-repo", argv)
    ?? environment.CONTEXT_FACTORY_REPO
    ?? DEFAULT_CONTEXT_REPOSITORY;
}

export async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`create-monorepo-template\n\nUsage:\n  pnpm dlx @markromolecule/create-monorepo-template@latest [--context-repo <git-url>]\n\nDefault context factory:\n  ${DEFAULT_CONTEXT_REPOSITORY}\n\nEnvironment:\n  CONTEXT_FACTORY_REPO   Override the context-factory Git repository URL`);
    return;
  }
  const contextRepository = resolveContextRepository();
  const answers = await collectAnswers();
  const spinner = p.spinner();
  spinner.start("Creating project");
  const root = await scaffoldProject(answers, { cwd: process.cwd(), contextRepository });
  spinner.stop("Project created");
  p.outro(`Created ${root}\n\nNext: cd ${answers.projectName} && pnpm install`);
}

const isEntryPoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  main().catch((error: unknown) => {
    p.cancel(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
