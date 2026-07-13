#!/usr/bin/env node
import * as p from "@clack/prompts";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OCTO_BANNER, OCTO_PACKAGE_NAME } from "./branding.js";
import { OFFICIAL_CONTEXT_REPOSITORY } from "./constants.js";
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
): string | undefined {
  return optionValue("--context-repo", argv)
    ?? environment.CONTEXT_FACTORY_REPO;
}

export function getHelpText(): string {
  return `${OCTO_BANNER}

Usage:
  pnpm dlx ${OCTO_PACKAGE_NAME}@latest [--context-repo <git-url>]
  octo [--context-repo <git-url>]

Options:
  -h, --help       Show help
  -v, --version    Show the Octo CLI version

Bundled context factory:
  Included in the published package

Git-backed override:
  ${OFFICIAL_CONTEXT_REPOSITORY}

Environment:
  CONTEXT_FACTORY_REPO   Override the context-factory Git repository URL`;
}

export async function main(): Promise<void> {
  if (process.argv.includes("--version") || process.argv.includes("-v")) {
    console.log(OCTO_BANNER);
    return;
  }
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(getHelpText());
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
