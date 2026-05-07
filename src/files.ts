import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { files as suseeFiles } from "@suseejs/files";
import type {
  CacheDatabaseFile,
  CacheDatabaseObject,
  CachePrJsonFile,
  CacheSubdomainFile,
  CacheTempDataFile,
  CacheTempDataObject,
  EntryObject,
  RawEntryObject,
  RequestType,
} from "./types.js";

// cache
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRootDir = path.resolve(moduleDir, "..");
const cacheDir = path.resolve(packageRootDir, "cache");
const cachePrSubdomainsPath = path.resolve(cacheDir, "pr/sub_domains.json");
const cachePrDatabasePath = path.resolve(cacheDir, "pr/database.json");
const cachePrJsonFilesPath = path.resolve(cacheDir, "pr/files.json");
const cacheTempDataPath = path.resolve(cacheDir, "temp/data.json");

// Ensure cache directories and files exist
function ensureCacheStructure() {
  const requiredDirs = [
    path.dirname(cachePrSubdomainsPath),
    path.dirname(cachePrDatabasePath),
    path.dirname(cachePrJsonFilesPath),
    path.dirname(cacheTempDataPath),
  ];

  const requiredFiles = [
    {
      path: cachePrSubdomainsPath,
      defaultContent: JSON.stringify({ registered: [], reserved: [] }),
    },
    { path: cachePrDatabasePath, defaultContent: JSON.stringify({}) },
    {
      path: cachePrJsonFilesPath,
      defaultContent: JSON.stringify({ json_files: [] }),
    },
    {
      path: cacheTempDataPath,
      defaultContent: JSON.stringify({ temp_object: [] }),
    },
  ];

  // Create directories if missing
  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Create files with default content if missing
  for (const file of requiredFiles) {
    if (!fs.existsSync(file.path)) {
      fs.writeFileSync(file.path, file.defaultContent);
    }
  }
}

// Call ensureCacheStructure during module initialization
ensureCacheStructure();

export async function readTempCacheData() {
  const str = (await suseeFiles.readFile(cacheTempDataPath)).str;
  return JSON.parse(str) as CacheTempDataFile;
}

export async function writeTempCacheData(obj: CacheTempDataObject) {
  const old = await readTempCacheData();
  const newData: CacheTempDataFile = {
    temp_object: [obj, ...old.temp_object],
  };
  await suseeFiles.writeFile(cacheTempDataPath, JSON.stringify(newData));
}

export function readPrCacheFiles() {
  const subDomains = async () => {
    const str = (await suseeFiles.readFile(cachePrSubdomainsPath)).str;
    return JSON.parse(str) as CacheSubdomainFile;
  };
  const data = async () => {
    const str = (await suseeFiles.readFile(cachePrDatabasePath)).str;
    return JSON.parse(str) as CacheDatabaseFile;
  };
  const files = async () => {
    const str = (await suseeFiles.readFile(cachePrJsonFilesPath)).str;
    return JSON.parse(str) as CachePrJsonFile;
  };
  return { subDomains, data, files };
}

export function writePrCacheFiles() {
  const read = readPrCacheFiles();
  const subDomains = async (sub_domain: string) => {
    const old = await read.subDomains();
    const newData: CacheSubdomainFile = {
      registered: [sub_domain, ...old.registered],
      reserved: [...old.reserved],
    };
    await suseeFiles.writeFile(cachePrSubdomainsPath, JSON.stringify(newData));
  };
  const data = async (
    sub_domain: string,
    obj: CacheDatabaseObject,
    type: "added" | "modified",
  ) => {
    const old = await read.data();
    if (type === "added") {
      if (!Object.keys(old).includes(sub_domain)) {
        old[sub_domain] = obj;
      }
      await suseeFiles.writeFile(cachePrDatabasePath, JSON.stringify(old));
      return;
    }
    if (type === "modified") {
      old[sub_domain] = obj;
      await suseeFiles.writeFile(cachePrDatabasePath, JSON.stringify(old));
      return;
    }
  };
  const files = async (file: string) => {
    const old = await read.files();
    const newData: CachePrJsonFile = {
      json_files: [file, ...old.json_files],
    };
    await suseeFiles.writeFile(cachePrJsonFilesPath, JSON.stringify(newData));
  };
  return { subDomains, data, files };
}
// json entries
async function readEntries(entryDir: string) {
  const obj: EntryObject[] = [];
  const entryDirPath = path.resolve(process.cwd(), entryDir);
  const entryFiles = await fs.promises.readdir(entryDirPath);
  const jsonFiles = entryFiles.filter((file) => path.extname(file) === ".json");
  for await (const file of jsonFiles) {
    const filePath = path.resolve(process.cwd(), entryDir, file);
    const fileContent = (await suseeFiles.readFile(filePath)).str;
    const raw = JSON.parse(fileContent) as RawEntryObject;
    const rawObject: EntryObject = {
      sub_domain: raw.sub_domain,
      cname_value: raw.cname_value,
      request_type: raw.request_type,
      cfp: raw.cfp ?? false,
    };
    obj.push(rawObject);
  }
  return {
    entryObjects: obj,
    jsonFiles,
  };
}
export function baseName(str: string) {
  const base = path.basename(str).split(".")[0] as string;
  return base;
}
export async function findChangedFile(entryDir: string) {
  let status = true;
  const message: { passed: string; error: string } = {
    passed: `Entry files checks are passed.`,
    error: "",
  };
  const foundObject = {} as EntryObject;
  let requestType: RequestType | undefined;
  let foundJsonFile: string | undefined;
  const read_entries = await readEntries(entryDir);
  const read_pr = readPrCacheFiles();
  const oldJsonFiles = (await read_pr.files()).json_files;
  const newRegisterFiles = read_entries.jsonFiles.filter(
    (file) => !oldJsonFiles.includes(file),
  );
  if (newRegisterFiles.length > 1) {
    status = false;
    message.error = `Found more than one register files, allowed one register/update/remove request per PR.`;
    return {
      status,
      message,
      foundObject: {},
      requestType: undefined,
      foundJsonFile,
    };
  }
  if (newRegisterFiles.length === 1) {
    const jsonFile = newRegisterFiles[0] as string;
    foundJsonFile = jsonFile;
    const jsonBaseName = baseName(jsonFile).trim();
    const jsonFilePath = suseeFiles.joinPath(entryDir, jsonFile);
    const fileContent = (await suseeFiles.readFile(jsonFilePath)).str;
    const raw = JSON.parse(fileContent) as RawEntryObject;
    if (raw.request_type !== "register") {
      status = false;
      message.error = `You added "${jsonFile}" to subdomains dir, request type must be "register", found "${raw.request_type}"`;
      return {
        status,
        message,
        foundObject: {},
        requestType: undefined,
        foundJsonFile,
      };
    }
    if (raw.sub_domain !== jsonBaseName) {
      status = false;
      message.error = `You added json file name "${jsonBaseName}" must be equal to subdomain name "${raw.sub_domain}" that you want to register.`;
      return {
        status,
        message,
        foundObject: {},
        requestType: undefined,
        foundJsonFile,
      };
    }
    foundObject.sub_domain = raw.sub_domain;
    foundObject.cname_value = raw.cname_value;
    foundObject.request_type = raw.request_type;
    foundObject.cfp = raw.cfp ?? false;
    requestType = "register";
  }
  if (newRegisterFiles.length === 0) {
    const entryObjects = read_entries.entryObjects;
    const oldData = await read_pr.data();
    let foundObj = 0;
    for (const obj of entryObjects) {
      const foundKey = Object.keys(oldData).find(
        (key) => obj.sub_domain === key,
      );
      if (foundKey) {
        const oldDataObject = oldData[foundKey] as CacheDatabaseObject;
        if (oldDataObject.last_request_type !== obj.request_type) {
          foundObj += 1;
          if (obj.request_type === "register") {
            status = false;
            message.error = `Can not change "${oldDataObject.last_request_type}" to "${obj.request_type}" in "${oldDataObject.json_file_name}".`;
            return {
              status,
              message,
              foundObject: {},
              requestType: undefined,
              foundJsonFile,
            };
          }
          if (
            obj.request_type === "update" &&
            oldDataObject.cname_value === obj.cname_value
          ) {
            status = false;
            message.error = `Changed "${oldDataObject.last_request_type}" to "${obj.request_type}" in "${oldDataObject.json_file_name}".But cname value is unchanged`;
            return {
              status,
              message,
              foundObject: {},
              requestType: undefined,
              foundJsonFile,
            };
          }
        }
        if (
          oldDataObject.cname_value !== obj.cname_value &&
          obj.request_type === "update"
        ) {
          foundObj += 1;
          foundObject.sub_domain = obj.sub_domain;
          foundObject.cname_value = obj.cname_value;
          foundObject.request_type = obj.request_type;
          foundObject.cfp = obj.cfp ?? false;
          requestType = "update";
        } // update
        if (obj.request_type === "remove") {
          foundObj += 1;
          foundObject.sub_domain = obj.sub_domain;
          foundObject.cname_value = obj.cname_value;
          foundObject.request_type = obj.request_type;
          foundObject.cfp = obj.cfp ?? false;
          requestType = "remove";
        }
      } // found key
    } // for loop
    if (foundObj === 0) {
      status = false;
      message.error = `Found no json file added or modified at "subdomains" directory.`;
      return {
        status,
        message,
        foundObject: {},
        requestType: undefined,
        foundJsonFile,
      };
    }
    if (foundObj > 1) {
      status = false;
      message.error = `Found more than one json file added or modified at "subdomains" directory,allowed one register/update/remove request per PR.`;
      return {
        status,
        message,
        foundObject: {},
        requestType: undefined,
        foundJsonFile,
      };
    }
  }
  return {
    status,
    message,
    foundObject,
    requestType,
    foundJsonFile,
  };
}
