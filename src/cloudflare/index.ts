import { files } from "@suseejs/files";
import type { CnameObject, SubdomainObject } from "../types.js";
import { mmdns } from "./mmdns.js";

const updateCachePath = "cache/update.json";
const removeCachePath = "cache/remove.json";
const registerCachePath = "cache/register.json";

const isInDNSList = async (
  sub_domain: string,
  api_token: string,
  zone_Id: string,
) => (await mmdns(api_token, zone_Id).findRecord(sub_domain)).exists;

export async function readRegisterDNSFiles() {
  const str = (await files.readFile(registerCachePath)).str;
  return JSON.parse(str) as SubdomainObject[];
}
export async function readUpdateDNSFiles() {
  const str = (await files.readFile(updateCachePath)).str;
  return JSON.parse(str) as CnameObject[];
}
export async function readRemoveDNSFiles() {
  const str = (await files.readFile(removeCachePath)).str;
  return JSON.parse(str) as CnameObject[];
}
// ------------------------------------------------------
export async function writeRegisterDNSFiles(
  obj: SubdomainObject,
  api_token: string,
  zone_Id: string,
) {
  const oldDnsRecords = await readRegisterDNSFiles();
  let newDnsRecords = [obj, ...oldDnsRecords];
  const found = newDnsRecords.find(
    async (m) => await isInDNSList(m.sub_domain, api_token, zone_Id),
  );
  if (found) {
    const index = newDnsRecords.findIndex(
      (m) => m.sub_domain === found.sub_domain,
    );
    newDnsRecords = newDnsRecords.splice(index, 1);
  }
  await files.writeFile(registerCachePath, JSON.stringify(newDnsRecords));
}
export async function writeUpdateDNSFiles(
  obj: CnameObject,
  api_token: string,
  zone_Id: string,
) {
  const oldDnsRecords = await readUpdateDNSFiles();
  let newDnsRecords = [obj, ...oldDnsRecords];
  const found = newDnsRecords.find(
    async (m) => await isInDNSList(m.sub_domain, api_token, zone_Id),
  );
  if (found) {
    const index = newDnsRecords.findIndex(
      (m) => m.sub_domain === found.sub_domain,
    );
    newDnsRecords = newDnsRecords.splice(index, 1);
  }
  await files.writeFile(updateCachePath, JSON.stringify(newDnsRecords));
}
export async function writeRemoveDNSFiles(
  obj: CnameObject,
  api_token: string,
  zone_Id: string,
) {
  const oldDnsRecords = await readRemoveDNSFiles();
  let newDnsRecords = [obj, ...oldDnsRecords];
  const found = newDnsRecords.find(
    async (m) => await isInDNSList(m.sub_domain, api_token, zone_Id),
  );
  if (found) {
    const index = newDnsRecords.findIndex(
      (m) => m.sub_domain === found.sub_domain,
    );
    newDnsRecords = newDnsRecords.splice(index, 1);
  }
  await files.writeFile(removeCachePath, JSON.stringify(newDnsRecords));
}

// --------------------------------------------------------------
