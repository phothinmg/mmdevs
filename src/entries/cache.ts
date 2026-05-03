import { files } from "@suseejs/files";
import type { DNSObjects, SubdomainObject } from "../types.js";
// cache files
export const cacheFilesPath = "cache/files.json";
export const cacheNamesPath = "cache/names.json";
export const cacheMainPath = "cache/main.json";

// read cache
export function readCache() {
  return {
    file: async () => {
      const cacheFiles = (await files.readFile(cacheFilesPath)).str;
      return (JSON.parse(cacheFiles) ?? []) as string[];
    },
    name: async () => {
      const cacheNames = (await files.readFile(cacheNamesPath)).str;
      return (JSON.parse(cacheNames) ?? []) as string[];
    },
    main: async () => {
      const cacheMain = (await files.readFile(cacheMainPath)).str;
      return (JSON.parse(cacheMain) ?? []) as SubdomainObject[];
    },
  };
}

// write cache

export async function validCacheWrite(
  main: SubdomainObject[],
  file: string[],
  name: string[],
) {
  await files.writeFile(cacheMainPath, JSON.stringify(main));
  await files.writeFile(cacheFilesPath, JSON.stringify(file));
  await files.writeFile(cacheNamesPath, JSON.stringify(name));
}
