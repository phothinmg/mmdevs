import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { files } from "@suseejs/files";
import { reservedSubdomains } from "./reserve.js";

const require = createRequire(import.meta.url);
const deepEqual = require("deepequal");

interface Subdomain {
  subdomain: string;
}

interface CnameObject extends Subdomain {
  cname_value: string;
}

interface SubdomainObject extends CnameObject {
  github_username: string;
  register_date: string | Date;
}

interface RawObject extends SubdomainObject {
  $schema: string;
}
// root
const cwd = process.cwd();
const getBaseName = (str: string) => path.basename(str).split(".")[0];
// cache files
const cacheFilesPath = "cache/files.json";
const cacheNamesPath = "cache/names.json";
const cacheMainPath = "cache/main.json";
// read cache
async function readCache() {
  const cacheFiles = (await files.readFile(cacheFilesPath)).str;
  const cacheNames = (await files.readFile(cacheNamesPath)).str;
  const cacheMain = (await files.readFile(cacheMainPath)).str;
  return {
    files: (JSON.parse(cacheFiles) ?? []) as string[],
    names: (JSON.parse(cacheNames) ?? []) as string[],
    main: (JSON.parse(cacheMain) ?? []) as SubdomainObject[],
  };
}
// write cache
async function writeCache(
  main: SubdomainObject[],
  file: string[],
  name: string[],
) {
  // main
  await files.writeFile(cacheMainPath, JSON.stringify(main));
  // files
  await files.writeFile(cacheFilesPath, JSON.stringify(file));
  // names
  await files.writeFile(cacheNamesPath, JSON.stringify(name));
}
// read entry dir
async function readEntries(jsonFiles: string[]) {
  const objs: RawObject[] = [];
  for await (const file of jsonFiles) {
    const filePath = path.resolve(cwd, "subdomains", file);
    const fileContent = (await files.readFile(filePath)).str;
    objs.push(JSON.parse(fileContent) as RawObject);
  }
  return objs;
}
// find duplicate
async function findDuplicateFiles(items: string[]) {
  let ok = true;
  let logMessage = "";
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for await (const item of items) {
    if (seen.has(item)) {
      duplicates.add(item);
      continue;
    }
    seen.add(item);
  }

  const error = [...duplicates];
  if (error.length > 0) {
    logMessage = `[FAIL] Duplicate JSON files found in the "subdomains" directory: [${error.join(", ")}]\n`;
    ok = false;
  }
  return {
    ok,
    logMessage,
  };
}
async function checkSubdomainsObject(ob: RawObject, names?: string[]) {
  let ok = true;
  let logMessage = "";
  // regexp
  const githubRegex = /(^|\.)github\.io(?:\/.*)?$/i;
  const vercelRegex = /(^|\.)vercel-dns-[0-9]+\.com(?:\/.*)?$/i;
  const vercelRegexOld = /^cname\.vercel-dns\.com(?:\/.*)?$/i;
  const subDomainFormatRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
  // errors
  const cnameError: CnameObject[] = [];
  const formatError: Subdomain[] = [];
  const reservedError: Subdomain[] = [];
  const registeredError: Subdomain[] = [];
  const errorLines: string[] = [];

  // cname
  const cnGH = githubRegex.test(ob.cname_value);
  const vcNew = vercelRegex.test(ob.cname_value);
  const vcOld = vercelRegexOld.test(ob.cname_value);
  if (!cnGH && !vcNew && !vcOld) {
    cnameError.push({ subdomain: ob.subdomain, cname_value: ob.cname_value });
  }
  // subdomain format
  if (!subDomainFormatRegex.test(ob.subdomain)) {
    formatError.push({ subdomain: ob.subdomain });
  }
  // reserved subdomain
  if (reservedSubdomains.includes(ob.subdomain)) {
    reservedError.push({ subdomain: ob.subdomain });
  }
  // registered subdomain
  if (names && names.includes(ob.subdomain)) {
    registeredError.push({ subdomain: ob.subdomain });
  }

  if (cnameError.length > 0) {
    errorLines.push(
      `[FAIL] Invalid "cname_value":\n${cnameError.map((cn) => `- ${cn.subdomain} : ${cn.cname_value}\n`).join("")}\n`,
    );
  }
  if (formatError.length > 0) {
    errorLines.push(
      `[FAIL] Invalid subdomain format:\n${formatError.map((cn) => `- ${cn.subdomain} is not a valid subdomain format.\n`).join("")}\n`,
    );
  }
  if (reservedError.length > 0) {
    errorLines.push(
      `[FAIL] Reserved subdomain detected:\n${reservedError.map((cn) => `- ${cn.subdomain} is a reserved subdomain.\n`).join("")}\n`,
    );
  }
  if (registeredError.length > 0) {
    errorLines.push(
      `[FAIL] Subdomain already registered:\n${registeredError.map((cn) => `- ${cn.subdomain} is a registered subdomain.\n`).join("")}\n`,
    );
  }
  if (errorLines.length > 0) {
    ok = false;
    logMessage = errorLines.join("");
  }
  return {
    ok,
    logMessage,
  };
}

export async function validate(dir: string, prOwner: string) {
  // get json files from directory
  dir = path.resolve(cwd, dir);
  const _files = await fs.promises.readdir(dir);
  const jsonFiles = _files.filter((file) => path.extname(file) === ".json");
  // check duplicate files from "subdomain" directory
  const isDuplicate = await findDuplicateFiles(jsonFiles);

  let newMainContent: SubdomainObject[] = [];
  let newNamesContent: string[] = [];
  let newJsonFilesContent: string[] = [];
  if (!isDuplicate.ok) {
    console.log(isDuplicate.logMessage);
    process.exit(1);
  }
  // read the cache directory
  const cached = await readCache();
  // find new file(s) from entries
  const newEntryFiles: string[] = jsonFiles.filter(
    (file) => !cached.files.includes(file),
  );
  if (newEntryFiles.length > 1) {
    console.log(
      `[FAIL] Only one entry file is allowed. Found "${newEntryFiles.length}" files: [${newEntryFiles.map((ent) => path.relative(process.cwd(), path.join(dir, ent))).join(", ")}].`,
    );
    process.exit(1);
  }
  if (
    newEntryFiles.length === 0 &&
    deepEqual(jsonFiles.sort(), cached.files.sort())
  ) {
    // if no new files , may be update
    const entriesObject = await readEntries(jsonFiles);
    // filter updated files
    const updatedFiles = entriesObject.filter((ent) =>
      cached.main.some(
        (ma) =>
          ent.subdomain === ma.subdomain && ent.cname_value !== ma.cname_value,
      ),
    );
    if (updatedFiles.length === 0) {
      console.error(
        `[FAIL] No new JSON file was added or no existing file was edited.`,
      );
      process.exit(1);
    } else {
      for (const file of updatedFiles) {
        if (file.github_username !== prOwner) {
          console.error(
            `[FAIL] You do not have permission to update or edit the subdomain "${file.subdomain}".`,
          );
          process.exit(1);
        }
        const checkedObject = await checkSubdomainsObject(file);
        if (!checkedObject.ok) {
          console.error(checkedObject.logMessage);
          process.exit(1);
        }
        newNamesContent = [...cached.names];
        newJsonFilesContent = [...cached.files];
        const index = cached.main.findIndex(
          (obj) => obj.subdomain === file.subdomain,
        );
        let newEntryObject = {} as SubdomainObject;
        const { $schema: _schema, ...entryWithoutSchema } = file;
        newEntryObject = entryWithoutSchema as SubdomainObject;
        if (index !== -1) {
          cached.main[index] = newEntryObject;
        } else {
          cached.main.push(newEntryObject);
        }

        newMainContent = [...cached.main];
        await writeCache(newMainContent, newJsonFilesContent, newNamesContent);
        console.log("[OK] Subdomain configuration is valid.");
      }
      return;
    }
  }

  if (newEntryFiles.length === 0) {
    console.error(
      `[FAIL] No new JSON file was added or no existing file was edited.`,
    );
    process.exit(1);
  }

  let newEntryObject = {} as SubdomainObject;
  const newEntryPath = path.resolve(path.join(dir, newEntryFiles[0] as string));
  const newEntryContent = (await files.readFile(newEntryPath)).str;
  const baseName = getBaseName(newEntryPath);
  const newEntryRawObject = JSON.parse(newEntryContent) as RawObject;

  if (baseName !== newEntryRawObject.subdomain) {
    console.error(
      `[FAIL] The JSON file name "${baseName}" must match the subdomain "${newEntryRawObject.subdomain}".`,
    );
    process.exit(1);
  }
  if (prOwner !== newEntryRawObject.github_username) {
    console.error(
      `[FAIL] GitHub username validation failed. You must be the owner of this repository.`,
    );
    process.exit(1);
  }
  const checkedObject = await checkSubdomainsObject(
    newEntryRawObject,
    cached.names,
  );
  if (!checkedObject.ok) {
    console.error(checkedObject.logMessage);
    process.exit(1);
  }

  const { $schema: _schema, ...entryWithoutSchema } = newEntryRawObject;
  newEntryObject = entryWithoutSchema as SubdomainObject;
  newNamesContent = [newEntryObject.subdomain, ...cached.names];
  newJsonFilesContent = [...newEntryFiles, ...cached.files];
  const index = cached.main.findIndex(
    (obj) => obj.subdomain === newEntryObject.subdomain,
  );
  if (index !== -1) {
    cached.main[index] = newEntryObject;
  } else {
    cached.main.push(newEntryObject);
  }

  newMainContent = [...cached.main];
  await writeCache(newMainContent, newJsonFilesContent, newNamesContent);
  console.log("[OK] Subdomain configuration is valid.");
}
