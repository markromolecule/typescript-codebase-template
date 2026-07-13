#!/usr/bin/env node
import * as p from "@clack/prompts";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectAnswers } from "./prompts.js";
import { scaffoldProject } from "./scaffold.js";

function optionValue(name: string): string | undefined {
  const equals = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`create-monorepo-template\n\nUsage:\n  pnpm create monorepo-template [--context-repo <git-url>]\n\nEnvironment:\n  CONTEXT_FACTORY_REPO   Default context-factory Git repository URL`);
    return;
  }
  const contextRepository = optionValue("--context-repo") ?? process.env.CONTEXT_FACTORY_REPO;
  if (!contextRepository) {
    throw new Error("Set CONTEXT_FACTORY_REPO or pass --context-repo <git-url>.");
  }
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
