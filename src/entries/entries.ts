import fs from "node:fs";
import path from "node:path";
import { files } from "@suseejs/files";
import type { EntriesObject } from "../types.js";

export async function findDuplicateFiles(items: string[]) {
	let ok = true;
	const seen = new Set<string>();
	const duplicates = new Set<string>();

	for await (const item of items) {
		if (seen.has(item)) {
			duplicates.add(item);
			continue;
		}
		seen.add(item);
	}

	const errors = [...duplicates];
	if (errors.length > 0) {
		ok = false;
	}
	return {
		status: ok,
		errors,
	};
}

export async function readEntries(dir: string) {
	const objs: EntriesObject[] = [];
	// get json files from directory
	dir = path.resolve(process.cwd(), dir);
	const dirFiles = await fs.promises.readdir(dir);
	const jsonFiles = dirFiles.filter(
		(file) => path.extname(file) === ".json" || path.extname(file) === ".jsonc",
	);

	for await (const file of jsonFiles) {
		const filePath = path.resolve(process.cwd(), dir, file);
		const fileContent = (await files.readFile(filePath)).str;
		const read = JSON.parse(fileContent);
		const obj: EntriesObject = {
			sub_domain: read.sub_domain,
			cname_value: read.cname_value,
			remove: read.remove ?? false,
			cfp: read.cfp ?? false,
		};
		objs.push(obj);
	}
	return {
		entriesObjects: objs,
		jsonFiles,
	};
}
