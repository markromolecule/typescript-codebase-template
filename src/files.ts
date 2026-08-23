import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function stripJsonc(input: string): string {
  let source = input;
  if (source.charCodeAt(0) === 0xfeff) {
    source = source.slice(1);
  }

  let insideString = false;
  let isEscaped = false;
  let insideSingleLineComment = false;
  let insideMultiLineComment = false;
  let result = "";

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const nextChar = source[i + 1];

    if (insideSingleLineComment) {
      if (char === "\n" || char === "\r") {
        insideSingleLineComment = false;
        result += char;
      }
      continue;
    }

    if (insideMultiLineComment) {
      if (char === "*" && nextChar === "/") {
        insideMultiLineComment = false;
        i++;
      }
      continue;
    }

    if (insideString) {
      result += char;
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        insideString = false;
      }
      continue;
    }

    if (char === '"') {
      insideString = true;
      result += char;
      continue;
    }

    if (char === "/" && nextChar === "/") {
      insideSingleLineComment = true;
      i++;
      continue;
    }

    if (char === "/" && nextChar === "*") {
      insideMultiLineComment = true;
      i++;
      continue;
    }

    if (char === ",") {
      let j = i + 1;
      let isTrailing = false;
      while (j < source.length) {
        const c = source[j];
        const nextC = source[j + 1];
        if (c === " " || c === "\t" || c === "\n" || c === "\r") {
          j++;
          continue;
        }
        if (c === "/" && nextC === "/") {
          j += 2;
          while (j < source.length && source[j] !== "\n" && source[j] !== "\r") {
            j++;
          }
          continue;
        }
        if (c === "/" && nextC === "*") {
          j += 2;
          while (j < source.length && !(source[j] === "*" && source[j + 1] === "/")) {
            j++;
          }
          j += 2;
          continue;
        }
        if (c === "}" || c === "]") {
          isTrailing = true;
        }
        break;
      }
      if (isTrailing) {
        continue;
      }
    }

    result += char;
  }

  return result;
}

export function parseJsonc<T = Record<string, unknown>>(text: string): T {
  return JSON.parse(stripJsonc(text)) as T;
}

export async function readJson<T = Record<string, unknown>>(path: string): Promise<T> {
  const contents = await readFile(path, "utf8");
  return parseJsonc<T>(contents);
}

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
  const packageJson = await readJson<{
    scripts?: Record<string, string>;
    [key: string]: unknown;
  }>(packageJsonPath);
  packageJson.scripts = { ...packageJson.scripts, [name]: command };
  await writeJson(packageJsonPath, packageJson);
}

export async function updatePackageJson(
  packageJsonPath: string,
  update: (packageJson: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  await updateJson(packageJsonPath, update);
}

export async function updateJson(
  path: string,
  update: (value: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const value = await readJson(path);
  await writeJson(path, update(value));
}
