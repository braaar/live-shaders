import { readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Recursively collect .glsl files under a directory.
 * Returns paths relative to the given directory, using forward slashes.
 */
export async function collectShaderFiles(directory: string, prefix: string = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectShaderFiles(fullPath, nextPrefix)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".glsl")) {
      files.push(nextPrefix.replace(/\\/g, "/"));
    }
  }

  return files;
}

export async function getShaderFiles(root: string): Promise<string[]> {
  try {
    return (await collectShaderFiles(root)).sort();
  } catch {
    return [];
  }
}

export async function getMusicFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter(
        (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".mp3"),
      )
      .map((entry) => `music/${entry.name}`)
      .sort();
  } catch {
    return [];
  }
}
