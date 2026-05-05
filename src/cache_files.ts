import { files } from "@suseejs/files";
import type {
  SubdomainsJsonFile,
  DataBaseJsonFile,
  DataBaseJsonObject,
  TempDataFile,
  TempDataFiles,
} from "./types.js";

const cacheSubdomainJsonPath = "cache/pr/sub_domains.json";
const cacheDataBaseJsonPath = "cache/pr/database.json";
const cacheTempDataPath = "cache/temp/data.json";

export async function readCacheTempDataFile() {
  const str = (await files.readFile(cacheTempDataPath)).str;
  return JSON.parse(str) as TempDataFiles;
}
export async function writeCacheTempDataFile(obj: TempDataFile) {
  const old = await readCacheTempDataFile();
  const newData = [obj, ...old];
  await files.writeFile(cacheTempDataPath, JSON.stringify(newData));
}
export async function readCacheDataBaseFile() {
  const str = (await files.readFile(cacheDataBaseJsonPath)).str;
  return JSON.parse(str) as DataBaseJsonFile;
}
export async function writeCacheDataBaseFile(
  key: string,
  obj: DataBaseJsonObject,
) {
  let json_data = await readCacheDataBaseFile();
  if (!Object.keys(json_data).includes(key)) {
    json_data[key] = obj;
  }
  const str = JSON.stringify(json_data);
  await files.writeFile(cacheDataBaseJsonPath, str);
}
export async function readCacheSubdomainFile() {
  const str = (await files.readFile(cacheSubdomainJsonPath)).str;
  return JSON.parse(str) as SubdomainsJsonFile;
}
export async function writeCacheSubdomainFile(obj: SubdomainsJsonFile) {
  const str = JSON.stringify(obj);
  await files.writeFile(cacheSubdomainJsonPath, str);
}
