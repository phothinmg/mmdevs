import path from "node:path";
import { files } from "@suseejs/files";
import {
  writeRegisterDNSFiles,
  writeRemoveDNSFiles,
  writeUpdateDNSFiles,
} from "../cloudflare/index.js";
import type {
  CnameObject,
  EntriesObject,
  PRType,
  RawObject,
  SubdomainObject,
} from "../types.js";
import { readCache, validCacheWrite } from "./cache.js";
import { checkSubdomainsObject } from "./check_sd.js";
import { findDuplicateFiles, readEntries } from "./entries.js";

const getBaseName = (str: string) => path.basename(str).split(".")[0] as string;

export async function entry(
  dir: string,
  pr_login: string,
  pr_type: PRType,
  dns_api_token: string,
  zone_Id: string,
): Promise<{
  status: boolean;
  message: string;
}> {
  let str = `[ENTRY:OK] Entries check passed`;
  const errors: string[] = [];
  let ok = true;
  let newCacheFiles: string[] = [];
  let newCacheNames: string[] = [];
  let newCacheMain: SubdomainObject[] = [];
  // read the entry directory
  const readEntriesFiles = await readEntries(dir);
  // check duplicates in entry directory
  const isDuplicates = await findDuplicateFiles(readEntriesFiles.jsonFiles);
  if (!isDuplicates.status) {
    errors.push(
      `Duplicate JSON files found in the ${dir} directory: [${isDuplicates.errors.join(", ")}]`,
    );
  }
  // handle cache
  const readCachedDir = readCache();
  const cacheFiles = await readCachedDir.file();
  const cacheMain = await readCachedDir.main();
  const cacheNames = await readCachedDir.name();
  // filter new register files
  const newRegisterFiles = readEntriesFiles.jsonFiles.filter(
    (file) => !cacheFiles.includes(file),
  );

  if (newRegisterFiles.length === 0) {
    const entriesObjects = readEntriesFiles.entriesObjects;
    // updated files from entries
    const updatedFiles = entriesObjects.filter((ent) =>
      cacheMain.some(
        (cache) =>
          ent.sub_domain === cache.sub_domain &&
          ent.cname_value !== cache.cname_value &&
          !ent.remove,
      ),
    ); //
    // remove files from entries
    const removeFiles = entriesObjects.filter((ent) =>
      cacheMain.some(
        (cache) =>
          ent.sub_domain === cache.sub_domain &&
          ent.cname_value === cache.cname_value &&
          ent.remove,
      ),
    ); //

    if (updatedFiles.length === 1) {
      if (pr_type !== "update") {
        errors.push(
          `${updatedFiles.length} updated file(s) found, but your PR type on PR body is ${pr_type}`,
        );
      }
      const file = updatedFiles[0] as EntriesObject;

      const gu = cacheMain.find((m) => m.sub_domain === file.sub_domain);
      if (!gu) {
        errors.push(
          `Sub-domain "${file.sub_domain}" you want to update dose not exists.`,
        );
      }
      if (gu && gu.github_username !== pr_login) {
        errors.push(
          `You have not right to update sub-domain ${file.sub_domain}`,
        );
      }
      const passed = await checkSubdomainsObject(
        { sub_domain: file.sub_domain, cname_value: file.cname_value },
        cacheNames,
      );
      if (!passed.status) {
        errors.push(
          `Invalid sub-domain or cname_value of sub-domain: ${file.sub_domain} to update`,
        );
      }
      // -------------------------------------------------------------------//
      // ### RETURN
      if (errors.length > 0) {
        str = `[VALIDATING:FAIL] Validation failed:
${errors.map((m) => `- ${m}\n`)}`;
        ok = false;
        return {
          status: ok,
          message: str.trimEnd(),
        };
      } else {
        const index = cacheMain.findIndex(
          (main) => main.sub_domain === file.sub_domain,
        );
        if (index !== -1) {
          (cacheMain[index] as SubdomainObject).cname_value = file.cname_value;
        }
        newCacheMain = [...cacheMain];
        newCacheFiles = [...cacheFiles];
        newCacheNames = [...cacheNames];
        await validCacheWrite(newCacheMain, newCacheFiles, newCacheNames);
        const temp_update_content: CnameObject = {
          sub_domain: file.sub_domain,
          cname_value: file.cname_value,
        };
        await writeUpdateDNSFiles(temp_update_content, dns_api_token, zone_Id);
        return {
          status: ok,
          message: str.trimEnd(),
        };
      }

      // -------------------------------------------------------------------------------------//
    } else if (removeFiles.length === 1) {
      if (pr_type !== "remove") {
        errors.push(
          `${removeFiles.length} file(s) found for removal, but the PR type specified in the PR body is ${pr_type}`,
        );
      }
      const file = removeFiles[0] as EntriesObject;

      const gu = cacheMain.find((m) => m.sub_domain === file.sub_domain);
      if (!gu) {
        errors.push(
          `The sub-domain "${file.sub_domain}" you want to remove does not exist`,
        );
      }
      if (gu && gu.github_username !== pr_login) {
        errors.push(
          `You do not have the rights to remove the sub-domain ${file.sub_domain}`,
        );
      }
      const passed = await checkSubdomainsObject(
        { sub_domain: file.sub_domain, cname_value: file.cname_value },
        cacheNames,
      );
      if (!passed.status) {
        errors.push(
          `Invalid sub-domain or CNAME value for the sub-domain: ${file.sub_domain} to remove`,
        );
      }
      // -------------------------------------------------------------------//
      // ### RETURN
      if (errors.length > 0) {
        str = `[VALIDATING:FAIL] Validation failed:
${errors.map((m) => `- ${m}\n`)}`;
        ok = false;
        return {
          status: ok,
          message: str.trimEnd(),
        };
      } else {
        const fileToRemove = cacheFiles.find(
          (cf) => getBaseName(cf) === file.sub_domain,
        ) as string;
        const index = cacheMain.findIndex(
          (main) => main.sub_domain === file.sub_domain,
        );
        newCacheMain = cacheMain.splice(index, 1);
        newCacheFiles = cacheFiles.filter((f) => f !== fileToRemove);
        newCacheNames = cacheNames.filter((name) => name !== file.sub_domain);
        await validCacheWrite(newCacheMain, newCacheFiles, newCacheNames);
        const temp_remove_content: CnameObject = {
          sub_domain: file.sub_domain,
          cname_value: file.cname_value,
        };
        await writeRemoveDNSFiles(temp_remove_content, dns_api_token, zone_Id);
        return {
          status: ok,
          message: str.trimEnd(),
        };
      }

      // -------------------------------------------------------------------//
    } else {
      if (updatedFiles.length === 0 && removeFiles.length === 0) {
        errors.push(
          `No new registration JSON files, no existing files were edited, or no existing files to remove`,
        );
      }
      if (updatedFiles.length > 1 || removeFiles.length > 1) {
        errors.push(
          `More than one update/remove file found. Only one update/remove request is allowed per PR`,
        );
      }
      if (errors.length > 0) {
        str = `[VALIDATING:FAIL] Validation failed:
${errors.map((m) => `- ${m}\n`)}`;
        ok = false;
      }

      return {
        status: ok,
        message: str.trimEnd(),
      };
    }
  } else if (newRegisterFiles.length === 1) {
    const newEntryObject = {} as SubdomainObject;
    const newEntryPath = path.resolve(
      path.join(dir, newRegisterFiles[0] as string),
    );
    const newEntryContent = (await files.readFile(newEntryPath)).str;
    const baseName = getBaseName(newEntryPath);
    const newEntryRawObject = JSON.parse(newEntryContent) as RawObject;

    if (baseName !== newEntryRawObject.sub_domain) {
      errors.push(
        `The JSON file name "${baseName}" must match the sub-domain "${newEntryRawObject.sub_domain}"`,
      );
    }
    const checkedObject = await checkSubdomainsObject({
      sub_domain: newEntryRawObject.sub_domain,
      cname_value: newEntryRawObject.cname_value,
    });
    if (!checkedObject.status) {
      errors.push(
        `Invalid sub-domain or CNAME value for the sub-domain: ${newEntryRawObject.sub_domain} to register`,
      );
    }
    if (errors.length > 0) {
      str = `[VALIDATING:FAIL] Validation failed:
${errors.map((m) => `- ${m}\n`)}`;
      ok = false;
      return {
        status: ok,
        message: str.trimEnd(),
      };
    } else {
      newEntryObject.sub_domain = newEntryRawObject.sub_domain;
      newEntryObject.cname_value = newEntryRawObject.cname_value;
      newEntryObject.github_username = pr_login;
      newEntryObject.cfp = newEntryRawObject.cfp ?? false;
      newEntryObject.remove = false;
      newEntryObject.register_date = new Date();
      //
      newCacheMain = [newEntryObject, ...cacheMain].sort(
        (a, b) =>
          (b.register_date as Date).getTime() -
          (a.register_date as Date).getTime(),
      );
      newCacheFiles = [...newRegisterFiles, ...cacheFiles];
      newCacheNames = [newEntryRawObject.sub_domain, ...cacheNames];
      await validCacheWrite(newCacheMain, newCacheFiles, newCacheNames);
      await writeRegisterDNSFiles(newEntryObject, dns_api_token, zone_Id);
      return {
        status: ok,
        message: str.trimEnd(),
      };
    }
  } else {
    // falsely exit
    errors.push(
      `More than one JSON entries files found, allowed to request one new sub-domain per PR`,
    );
    if (errors.length > 0) {
      str = `[ENTRY:FAIL] Entries check failed:
${errors.map((m) => `- ${m}\n`)}`;
      ok = false;
    }

    return {
      status: ok,
      message: str.trimEnd(),
    };
  }
}
