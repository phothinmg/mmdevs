import {
	findChangedFile,
	readPrCacheFiles,
	writePrCacheFiles,
	writeTempCacheData,
} from "./files.js";
import { checkEntryFormats } from "./format.js";
import type {
	CacheDatabaseObject,
	CacheTempDataObject,
	EntryObject,
} from "./types.js";

export async function checkEntries(
	entryDir: string,
	gh_user: string,
	gh_id: number,
) {
	let status = true;
	const message: { passed: string; error: string } = {
		passed: `✅ All entry checks are passed.`,
		error: "",
	};
	const today = new Date();
	const newDatabaseObj = {} as CacheDatabaseObject;
	// finding changed file
	const foundChanged = await findChangedFile(entryDir);
	if (!foundChanged.status) {
		status = false;
		message.error = foundChanged.message.error;
		return { status, message };
	}
	// found entry object
	const foundObject = foundChanged.foundObject as EntryObject;
	// read and write cached PR
	const readCachePR = readPrCacheFiles();
	const writeCachePR = writePrCacheFiles();
	const oldFiles = await readCachePR.subDomains();
	const formatChecked = checkEntryFormats(
		oldFiles.registered,
		oldFiles.reserved,
	);
	const sdFormatChecked = formatChecked.added(foundObject);
	const cnFormatChecked = formatChecked.modified(foundObject);
	const tempDataObject: CacheTempDataObject = {
		sub_domain: foundObject.sub_domain,
		cname_value: foundObject.cname_value,
		request_type: foundObject.request_type,
	};
	if (foundChanged.requestType === "register") {
		if (!sdFormatChecked.status) {
			status = false;
			message.error = sdFormatChecked.message.error;
			return { status, message };
		}
		if (!cnFormatChecked.status) {
			status = false;
			message.error = cnFormatChecked.message.error;
			return { status, message };
		}
		newDatabaseObj.cname_value = foundObject.cname_value;
		newDatabaseObj.cname_history = [
			{ value: foundObject.cname_value, date: today },
		];
		newDatabaseObj.created_on = today;
		newDatabaseObj.modified_on = today;
		newDatabaseObj.github_user = gh_user;
		newDatabaseObj.github_id = gh_id;
		newDatabaseObj.dns_recorded = false;
		newDatabaseObj.last_request_type = "register";
		newDatabaseObj.json_file_name = foundChanged.foundJsonFile as string;
		await writeCachePR.files(foundChanged.foundJsonFile as string);
		await writeCachePR.subDomains(foundObject.sub_domain);
		await writeCachePR.data(foundObject.sub_domain, newDatabaseObj, "added");
		await writeTempCacheData(tempDataObject);
		return { status, message };
	}
	if (foundChanged.requestType === "update") {
		if (!cnFormatChecked.status) {
			status = false;
			message.error = cnFormatChecked.message.error;
			return { status, message };
		}
	}
	if (
		foundChanged.requestType === "update" ||
		foundChanged.requestType === "remove"
	) {
		const oldDataBase = await readCachePR.data();
		const foundKey = Object.keys(oldDataBase).find(
			(key) => key === foundObject.sub_domain,
		);
		const foundDataBaseObject = oldDataBase[
			foundKey as string
		] as CacheDatabaseObject;
		foundDataBaseObject.cname_value = foundObject.cname_value;
		foundDataBaseObject.cname_history = [
			{ value: foundObject.cname_value, date: today },
			...foundDataBaseObject.cname_history,
		];
		foundDataBaseObject.modified_on = today;
		foundDataBaseObject.last_request_type = foundObject.request_type;
		await writeCachePR.data(
			foundKey as string,
			foundDataBaseObject,
			"modified",
		);
		await writeTempCacheData(tempDataObject);
		return { status, message };
	}

	return { status, message };
}
