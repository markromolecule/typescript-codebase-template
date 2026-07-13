import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeText(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents.endsWith("\n") ? contents : `${contents}\n`, "utf8");
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeText(path, JSON.stringify(value, null, 2));
}

export async function addPackageScript(
  packageJsonPath: string,
  name: string,
  command: string,
): Promise<void> {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
    [key: string]: unknown;
  };
  packageJson.scripts = { ...packageJson.scripts, [name]: command };
  await writeJson(packageJsonPath, packageJson);
}
