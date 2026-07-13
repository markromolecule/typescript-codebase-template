import { readFileSync } from "node:fs";

interface PackageMetadata {
  name: string;
  version: string;
}

const packageMetadata = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageMetadata;

export const OCTO_NAME = "🐙 Octo CLI";
export const OCTO_PACKAGE_NAME = packageMetadata.name;
export const OCTO_VERSION = packageMetadata.version;
export const OCTO_BANNER = `${OCTO_NAME} v${OCTO_VERSION}`;
