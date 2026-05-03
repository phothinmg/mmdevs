import Cloudflare from "cloudflare";
import fs from "node:fs";
import path from "node:path";
import { context, getOctokit } from "@actions/github";
import { files } from "@suseejs/files";
class MmDNS {
    _cf;
    _zoneId;
    _errors;
    _str;
    constructor(api_token, zone_Id) {
        this._cf = new Cloudflare({ apiToken: api_token });
        this._zoneId = zone_Id;
        this._errors = [];
        this._str = `✅ All dns process are passed`;
    }
    async list() {
        const records = await this._cf.dns.records.list({ zone_id: this._zoneId });
        return records.result;
    }
    async writeList(filePath) {
        const dnsList = await this.list();
        await files.writeFile(filePath, JSON.stringify(dnsList));
    }
    async createCname(subdomain, cnameValue, cfp = false) {
        const sub_domain = `${subdomain}.mmdevs.org`;
        const record = await this._cf.dns.records.create({
            zone_id: this._zoneId,
            type: "CNAME",
            name: sub_domain,
            content: cnameValue,
            ttl: 1,
            proxied: cfp,
        });
        this._str = `✅ Created subdomain : ${sub_domain} with ID : ${record.id}`;
        return this;
    }
    async findRecord(subdomain) {
        const sub_domain = `${subdomain}.mmdevs.org`;
        const recordsList = await this.list();
        const found = recordsList.find((rec) => rec.content && rec.name === sub_domain);
        const exists = !!found;
        return { exists, record: found };
    }
    async updateCname(subdomain, cnameValue) {
        const sub_domain = `${subdomain}.mmdevs.org`;
        const found = await this.findRecord(subdomain);
        if (!found.exists || !found.record) {
            this._errors.push(`Records for "${sub_domain}" dose not exists on DNS or error on search`);
        }
        if (this._errors.length > 0) {
            return this;
        }
        if (found.record) {
            if (found.record.content && found.record.content === cnameValue) {
                this._str = `Cname target want to update "${cnameValue}" is up to date`;
                return this;
            }
            else {
                await this._cf.dns.records.update(found.record.id, {
                    zone_id: this._zoneId,
                    type: "CNAME",
                    name: found.record.name,
                    content: cnameValue,
                    ttl: 1,
                    proxied: found.record.proxied ?? false,
                });
                this._str = `✅ Updated subdomain : "${found.record.name}" with CNAME target : "${cnameValue}"`;
                return this;
            }
        }
        else {
            return this;
        }
    }
    async removeCname(subdomain) {
        const sub_domain = `${subdomain}.mmdevs.org`;
        const found = await this.findRecord(subdomain);
        if (!found.exists || !found.record) {
            this._errors.push(`Records for "${sub_domain}" dose not exists on DNS or error on search`);
        }
        if (this._errors.length > 0) {
            return this;
        }
        if (found.record) {
            await this._cf.dns.records.delete(found.record.id, {
                zone_id: this._zoneId,
            });
            this._str = `✅ Removed subdomain : "${found.record.name}"`;
            return this;
        }
        else {
            return this;
        }
    }
    get message() {
        if (this._errors.length > 0) {
            this._str = `❌ Fail dns processes :\n${this._errors.map((m) => `- ${m}\n`)}`;
        }
        return this._str.trimEnd();
    }
}
const mmdns = (api_token, zone_Id) => new MmDNS(api_token, zone_Id);
const updateCachePath = "cache/update_dns.json";
const removeCachePath = "cache/remove_dns.json";
const registerCachePath = "cache/register_dns.json";
const isInDNSList = async (sub_domain, api_token, zone_Id) => (await mmdns(api_token, zone_Id).findRecord(sub_domain)).exists;
async function readRegisterDNSFiles() {
    const str = (await files.readFile(registerCachePath)).str;
    return JSON.parse(str);
}
async function readUpdateDNSFiles() {
    const str = (await files.readFile(updateCachePath)).str;
    return JSON.parse(str);
}
async function readRemoveDNSFiles() {
    const str = (await files.readFile(removeCachePath)).str;
    return JSON.parse(str);
}
async function writeRegisterDNSFiles(obj, api_token, zone_Id) {
    const oldDnsRecords = await readRegisterDNSFiles();
    let newDnsRecords = [obj, ...oldDnsRecords];
    const found = newDnsRecords.find(async (m) => await isInDNSList(m.sub_domain, api_token, zone_Id));
    if (found) {
        const index = newDnsRecords.findIndex((m) => m.sub_domain === found.sub_domain);
        newDnsRecords = newDnsRecords.splice(index, 1);
    }
    await files.writeFile(registerCachePath, JSON.stringify(newDnsRecords));
}
async function writeUpdateDNSFiles(obj, api_token, zone_Id) {
    const oldDnsRecords = await readUpdateDNSFiles();
    let newDnsRecords = [obj, ...oldDnsRecords];
    const found = newDnsRecords.find(async (m) => await isInDNSList(m.sub_domain, api_token, zone_Id));
    if (found) {
        const index = newDnsRecords.findIndex((m) => m.sub_domain === found.sub_domain);
        newDnsRecords = newDnsRecords.splice(index, 1);
    }
    await files.writeFile(updateCachePath, JSON.stringify(newDnsRecords));
}
async function writeRemoveDNSFiles(obj, api_token, zone_Id) {
    const oldDnsRecords = await readRemoveDNSFiles();
    let newDnsRecords = [obj, ...oldDnsRecords];
    const found = newDnsRecords.find(async (m) => await isInDNSList(m.sub_domain, api_token, zone_Id));
    if (found) {
        const index = newDnsRecords.findIndex((m) => m.sub_domain === found.sub_domain);
        newDnsRecords = newDnsRecords.splice(index, 1);
    }
    await files.writeFile(removeCachePath, JSON.stringify(newDnsRecords));
}
const cacheFilesPath = "cache/files.json";
const cacheNamesPath = "cache/names.json";
const cacheMainPath = "cache/main.json";
const cacheCheckNamesPath = "cache/check_names.json";
function readCache() {
    return {
        file: async () => {
            const cacheFiles = (await files.readFile(cacheFilesPath)).str;
            return (JSON.parse(cacheFiles) ?? []);
        },
        name: async () => {
            const cacheNames = (await files.readFile(cacheNamesPath)).str;
            return (JSON.parse(cacheNames) ?? []);
        },
        main: async () => {
            const cacheMain = (await files.readFile(cacheMainPath)).str;
            return (JSON.parse(cacheMain) ?? []);
        },
        checkNames: async () => {
            const cacheCheckNames = (await files.readFile(cacheCheckNamesPath)).str;
            return (JSON.parse(cacheCheckNames) ?? []);
        },
    };
}
async function validCacheWrite(main, file, name, checkNames) {
    await files.writeFile(cacheMainPath, JSON.stringify(main));
    await files.writeFile(cacheFilesPath, JSON.stringify(file));
    await files.writeFile(cacheNamesPath, JSON.stringify(name));
    await files.writeFile(cacheCheckNamesPath, JSON.stringify(checkNames));
}
const reservedSubdomains = [
    "app",
    "apps",
    "admin",
    "admins",
    "ai",
    "ad",
    "ads",
    "about",
    "api",
    "apis",
    "archive",
    "array",
    "archives",
    "arrays",
    "asm",
    "async",
    "awesome",
    "backup",
    "backups",
    "bar",
    "base",
    "basic",
    "basics",
    "bbs",
    "become",
    "bible",
    "blog",
    "blogs",
    "book",
    "books",
    "boolean",
    "bot",
    "browser",
    "bug",
    "build",
    "bots",
    "browsers",
    "bugs",
    "builds",
    "business",
    "career",
    "cdn",
    "center",
    "chat",
    "client",
    "chats",
    "clients",
    "cloud",
    "code",
    "community",
    "company",
    "communities",
    "companies",
    "compare",
    "compile",
    "console",
    "contact",
    "cookie",
    "contacts",
    "cookies",
    "copy",
    "copyright",
    "copyrights",
    "core",
    "create",
    "crew",
    "crews",
    "css",
    "data",
    "db",
    "ddns",
    "deal",
    "debug",
    "demo",
    "demos",
    "dev",
    "devs",
    "develop",
    "developer",
    "dir",
    "directory",
    "developers",
    "dirs",
    "directories",
    "dns",
    "doc",
    "docs",
    "dom",
    "domain",
    "donate",
    "domains",
    "donates",
    "dyn",
    "easy",
    "ecma",
    "editor",
    "email",
    "enterprise",
    "emails",
    "enterprises",
    "es2015",
    "es6",
    "event",
    "events",
    "exchange",
    "example",
    "faq",
    "faqs",
    "feed",
    "file",
    "files",
    "find",
    "foo",
    "format",
    "forum",
    "framework",
    "formats",
    "forums",
    "frameworks",
    "free",
    "front",
    "frontpage",
    "ftp",
    "function",
    "fund",
    "gallery",
    "games",
    "functions",
    "funds",
    "galleries",
    "games",
    "get",
    "git",
    "global",
    "group",
    "guide",
    "globals",
    "groups",
    "guides",
    "headquarter",
    "help",
    "home",
    "homepage",
    "host",
    "hosts",
    "hq",
    "html",
    "hub",
    "hubs",
    "i18n",
    "imap",
    "index",
    "info",
    "infos",
    "internet",
    "io",
    "js",
    "json",
    "l10n",
    "learn",
    "legal",
    "lesson",
    "libraries",
    "lib",
    "license",
    "like",
    "link",
    "learning",
    "legals",
    "lessons",
    "library",
    "licenses",
    "likes",
    "links",
    "live",
    "log",
    "login",
    "logo",
    "logout",
    "loop",
    "logs",
    "logos",
    "loops",
    "love",
    "mail",
    "main",
    "map",
    "market",
    "maps",
    "markets",
    "master",
    "media",
    "meet",
    "member",
    "members",
    "mobile",
    "module",
    "modules",
    "mx",
    "my",
    "native",
    "net",
    "network",
    "new",
    "newsgroup",
    "newsletter",
    "news",
    "newsgroups",
    "newsletters",
    "now",
    "ns",
    "ns1",
    "ns2",
    "object",
    "objects",
    "online",
    "open",
    "orig",
    "origin",
    "package",
    "page",
    "password",
    "permalink",
    "packages",
    "pages",
    "passwords",
    "permalinks",
    "plain",
    "pop3",
    "portal",
    "professional",
    "program",
    "project",
    "prototype",
    "pub",
    "portals",
    "professionals",
    "programs",
    "projects",
    "prototypes",
    "pubs",
    "raw",
    "readme",
    "regex",
    "readmes",
    "regexp",
    "register",
    "registration",
    "registered",
    "remote",
    "require",
    "rest",
    "review",
    "root",
    "review",
    "root",
    "reviews",
    "roots",
    "reviews",
    "roots",
    "rss",
    "run",
    "school",
    "script",
    "schools",
    "scripts",
    "search",
    "secure",
    "server",
    "service",
    "shop",
    "site",
    "servers",
    "services",
    "shops",
    "sites",
    "smtp",
    "socket",
    "source",
    "standard",
    "store",
    "string",
    "sub",
    "subdomain",
    "sockets",
    "sources",
    "standards",
    "stores",
    "strings",
    "subs",
    "subdomains",
    "subscribe",
    "support",
    "sync",
    "system",
    "tag",
    "team",
    "systems",
    "tags",
    "teams",
    "tech",
    "terminal",
    "test",
    "tip",
    "tool",
    "topic",
    "translate",
    "trend",
    "trick",
    "tools",
    "topics",
    "trends",
    "tricks",
    "trust",
    "trusted",
    "tutorial",
    "tweak",
    "type",
    "unit",
    "tutorials",
    "tweaks",
    "types",
    "units",
    "united",
    "unsubscribe",
    "uri",
    "url",
    "user",
    "utils",
    "utility",
    "uris",
    "urls",
    "users",
    "utilities",
    "validate",
    "var(s)",
    "virtual",
    "vpn",
    "vps",
    "wasm",
    "watch",
    "web",
    "webmail",
    "webmaster",
    "world",
    "myanmar",
];
async function checkSubdomainsObject(ob, names) {
    let ok = true;
    const githubRegex = /(^|\.)github\.io(?:\/.*)?$/i;
    const vercelRegex = /(^|\.)vercel-dns-[0-9]+\.com(?:\/.*)?$/i;
    const vercelRegexOld = /^cname\.vercel-dns\.com(?:\/.*)?$/i;
    const subDomainFormatRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
    const cnameError = [];
    const formatError = [];
    const reservedError = [];
    const registeredError = [];
    const errorLines = [];
    const cnGH = githubRegex.test(ob.cname_value);
    const vcNew = vercelRegex.test(ob.cname_value);
    const vcOld = vercelRegexOld.test(ob.cname_value);
    if (!cnGH && !vcNew && !vcOld) {
        cnameError.push({ sub_domain: ob.sub_domain, cname_value: ob.cname_value });
    }
    if (!subDomainFormatRegex.test(ob.sub_domain)) {
        formatError.push({ sub_domain: ob.sub_domain });
    }
    if (reservedSubdomains.includes(ob.sub_domain)) {
        reservedError.push({ sub_domain: ob.sub_domain });
    }
    if (names?.includes(ob.sub_domain)) {
        registeredError.push({ sub_domain: ob.sub_domain });
    }
    if (cnameError.length > 0) {
        errorLines.push(`Invalid "cname_value":\n${cnameError.map((cn) => `- ${cn.sub_domain} : ${cn.cname_value}\n`).join("")}\n`);
    }
    if (formatError.length > 0) {
        errorLines.push(`Invalid subdomain format:\n${formatError.map((cn) => `- ${cn.sub_domain} is not a valid subdomain format.\n`).join("")}\n`);
    }
    if (reservedError.length > 0) {
        errorLines.push(`Reserved subdomain detected:\n${reservedError.map((cn) => `- ${cn.sub_domain} is a reserved subdomain.\n`).join("")}\n`);
    }
    if (registeredError.length > 0) {
        errorLines.push(`Subdomain already registered:\n${registeredError.map((cn) => `- ${cn.sub_domain} is a registered subdomain.\n`).join("")}\n`);
    }
    if (errorLines.length > 0) {
        ok = false;
    }
    return {
        status: ok,
        errors: errorLines,
    };
}
async function findDuplicateFiles(items) {
    let ok = true;
    const seen = new Set();
    const duplicates = new Set();
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
async function readEntries(dir) {
    const objs = [];
    dir = path.resolve(process.cwd(), dir);
    const dirFiles = await fs.promises.readdir(dir);
    const jsonFiles = dirFiles.filter((file) => (path.extname(file) === ".json" || path.extname(file) === ".jsonc") &&
        file !== "example.jsonc");
    for await (const file of jsonFiles) {
        const filePath = path.resolve(process.cwd(), dir, file);
        const fileContent = (await files.readFile(filePath)).str;
        const read = JSON.parse(fileContent);
        const obj = {
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
const getBaseName = (str) => path.basename(str).split(".")[0];
async function entry(dir, pr_login, pr_type, dns_api_token, zone_Id) {
    let str = `✅ Entries check passed`;
    const errors = [];
    let ok = true;
    let newCacheFiles = [];
    let newCacheNames = [];
    let newCacheMain = [];
    let newCacheCheckNames = [];
    const readEntriesFiles = await readEntries(dir);
    const isDuplicates = await findDuplicateFiles(readEntriesFiles.jsonFiles);
    if (!isDuplicates.status) {
        errors.push(`Duplicate JSON files found in the ${dir} directory: [${isDuplicates.errors.join(", ")}]`);
    }
    const readCachedDir = readCache();
    const cacheFiles = await readCachedDir.file();
    const cacheMain = await readCachedDir.main();
    const cacheNames = await readCachedDir.name();
    const cacheCheckNames = await readCachedDir.checkNames();
    const newRegisterFiles = readEntriesFiles.jsonFiles.filter((file) => !cacheFiles.includes(file));
    if (newRegisterFiles.length === 0) {
        const entriesObjects = readEntriesFiles.entriesObjects;
        const updatedFiles = entriesObjects.filter((ent) => cacheMain.some((cache) => ent.sub_domain === cache.sub_domain &&
            ent.cname_value !== cache.cname_value &&
            !ent.remove));
        const removeFiles = entriesObjects.filter((ent) => cacheMain.some((cache) => ent.sub_domain === cache.sub_domain &&
            ent.cname_value === cache.cname_value &&
            ent.remove));
        if (updatedFiles.length === 1) {
            if (pr_type !== "update") {
                errors.push(`${updatedFiles.length} updated file(s) found, but your PR type on PR body is ${pr_type}`);
            }
            const file = updatedFiles[0];
            const gu = cacheMain.find((m) => m.sub_domain === file.sub_domain);
            if (!gu) {
                errors.push(`Sub-domain "${file.sub_domain}" you want to update dose not exists.`);
            }
            if (gu && gu.github_username !== pr_login) {
                errors.push(`You have not right to update sub-domain ${file.sub_domain}`);
            }
            const passed = await checkSubdomainsObject({ sub_domain: file.sub_domain, cname_value: file.cname_value }, cacheNames);
            if (!passed.status) {
                errors.push(`Invalid sub-domain or cname_value of sub-domain: ${file.sub_domain} to update`);
            }
            if (errors.length > 0) {
                str = `❌ Entries check failed :\n
${errors.map((m) => `- ${m}\n`)}`;
                ok = false;
                return {
                    status: ok,
                    message: str.trimEnd(),
                };
            }
            else {
                const index = cacheMain.findIndex((main) => main.sub_domain === file.sub_domain);
                if (index !== -1) {
                    cacheMain[index].cname_value = file.cname_value;
                }
                newCacheMain = [...cacheMain];
                newCacheFiles = [...cacheFiles];
                newCacheNames = [...cacheNames];
                newCacheCheckNames = [...cacheCheckNames];
                await validCacheWrite(newCacheMain, newCacheFiles, newCacheNames, newCacheCheckNames);
                const temp_update_content = {
                    sub_domain: file.sub_domain,
                    cname_value: file.cname_value,
                };
                await writeUpdateDNSFiles(temp_update_content, dns_api_token, zone_Id);
                return {
                    status: ok,
                    message: str.trimEnd(),
                };
            }
        }
        else if (removeFiles.length === 1) {
            if (pr_type !== "remove") {
                errors.push(`${removeFiles.length} file(s) found for removal, but the PR type specified in the PR body is ${pr_type}`);
            }
            const file = removeFiles[0];
            const gu = cacheMain.find((m) => m.sub_domain === file.sub_domain);
            if (!gu) {
                errors.push(`The sub-domain "${file.sub_domain}" you want to remove does not exist`);
            }
            if (gu && gu.github_username !== pr_login) {
                errors.push(`You do not have the rights to remove the sub-domain ${file.sub_domain}`);
            }
            const passed = await checkSubdomainsObject({ sub_domain: file.sub_domain, cname_value: file.cname_value }, cacheNames);
            if (!passed.status) {
                errors.push(`Invalid sub-domain or CNAME value for the sub-domain: ${file.sub_domain} to remove`);
            }
            if (errors.length > 0) {
                str = `❌ Entries check failed :\n
${errors.map((m) => `- ${m}\n`)}`;
                ok = false;
                return {
                    status: ok,
                    message: str.trimEnd(),
                };
            }
            else {
                const fileToRemove = cacheFiles.find((cf) => getBaseName(cf) === file.sub_domain);
                const index = cacheMain.findIndex((main) => main.sub_domain === file.sub_domain);
                newCacheMain = cacheMain.splice(index, 1);
                newCacheFiles = cacheFiles.filter((f) => f !== fileToRemove);
                newCacheNames = cacheNames.filter((name) => name !== file.sub_domain);
                newCacheCheckNames = cacheCheckNames.filter((name) => name !== file.sub_domain);
                await validCacheWrite(newCacheMain, newCacheFiles, newCacheNames, newCacheCheckNames);
                const temp_remove_content = {
                    sub_domain: file.sub_domain,
                    cname_value: file.cname_value,
                };
                await writeRemoveDNSFiles(temp_remove_content, dns_api_token, zone_Id);
                await files.deleteFile(fileToRemove);
                return {
                    status: ok,
                    message: str.trimEnd(),
                };
            }
        }
        else {
            if (updatedFiles.length === 0 && removeFiles.length === 0) {
                errors.push(`No new registration JSON files, no existing files were edited, or no existing files to remove`);
            }
            if (updatedFiles.length > 1 || removeFiles.length > 1) {
                errors.push(`More than one update/remove file found. Only one update/remove request is allowed per PR`);
            }
            if (errors.length > 0) {
                str = `❌ Entries check failed :\n
${errors.map((m) => `- ${m}\n`)}`;
                ok = false;
            }
            return {
                status: ok,
                message: str.trimEnd(),
            };
        }
    }
    else if (newRegisterFiles.length === 1) {
        const newEntryObject = {};
        const newEntryPath = path.resolve(path.join(dir, newRegisterFiles[0]));
        const newEntryContent = (await files.readFile(newEntryPath)).str;
        const baseName = getBaseName(newEntryPath);
        const newEntryRawObject = JSON.parse(newEntryContent);
        if (baseName !== newEntryRawObject.sub_domain) {
            errors.push(`The JSON file name "${baseName}" must match the sub-domain "${newEntryRawObject.sub_domain}"`);
        }
        const checkedObject = await checkSubdomainsObject({
            sub_domain: newEntryRawObject.sub_domain,
            cname_value: newEntryRawObject.cname_value,
        });
        if (!checkedObject.status) {
            errors.push(`Invalid sub-domain or CNAME value for the sub-domain: ${newEntryRawObject.sub_domain} to register`);
        }
        if (errors.length > 0) {
            str = `❌ Entries check failed :\n
${errors.map((m) => `- ${m}\n`)}`;
            ok = false;
            return {
                status: ok,
                message: str.trimEnd(),
            };
        }
        else {
            newEntryObject.sub_domain = newEntryRawObject.sub_domain;
            newEntryObject.cname_value = newEntryRawObject.cname_value;
            newEntryObject.github_username = pr_login;
            newEntryObject.cfp = newEntryRawObject.cfp ?? false;
            newEntryObject.remove = false;
            newEntryObject.register_date = new Date();
            newCacheMain = [newEntryObject, ...cacheMain].sort((a, b) => b.register_date.getTime() -
                a.register_date.getTime());
            newCacheFiles = [...newRegisterFiles, ...cacheFiles];
            newCacheNames = [newEntryRawObject.sub_domain, ...cacheNames];
            newCacheCheckNames = [newEntryRawObject.sub_domain, ...cacheCheckNames];
            await validCacheWrite(newCacheMain, newCacheFiles, newCacheNames, newCacheCheckNames);
            await writeRegisterDNSFiles(newEntryObject, dns_api_token, zone_Id);
            return {
                status: ok,
                message: str.trimEnd(),
            };
        }
    }
    else {
        errors.push(`More than one JSON entries files found, allowed to request one new sub-domain per PR`);
        if (errors.length > 0) {
            str = `❌ Entries check failed :\n
${errors.map((m) => `- ${m}\n`)}`;
            ok = false;
        }
        return {
            status: ok,
            message: str.trimEnd(),
        };
    }
}
const unwrapAutolink = (value) => value.replace(/^<([^>]+)>$/, "$1").trim();
function checkPrRequestBody(body) {
    body = body.replace(/<!--[\s\S]*?-->/gm, "").trim();
    let pr_type;
    const failures = [];
    const prTypeMatch = body.match(/^\s*-\s*pr_type\s*:\s*(.+)\s*$/im);
    if (!prTypeMatch) {
        failures.push('Missing "pr_type : <type_of_pr>" field in PR body.');
    }
    else {
        if (!prTypeMatch[1]) {
            failures.push('Missing pr_type : "<type_of_pr>" field in PR body.');
        }
        else {
            const rawValue = prTypeMatch[1].trim();
            if (/^<?type_of_pr>?$/i.test(rawValue)) {
                failures.push('Replace placeholder value in "pr_type" field in PR body.');
            }
            const value = unwrapAutolink(rawValue);
            if (!/^(?:register|update|remove)$/i.test(value)) {
                failures.push(`The value of "pr_type" must be one of ("register", "update", "remove").`);
            }
            else {
                pr_type = value;
            }
        }
    }
    const pageRepoMatch = body.match(/^\s*-\s*site_repo\s*:\s*(.+)\s*$/im);
    if (!pageRepoMatch) {
        failures.push('Missing "site_repo : <repo_link>" field in PR body.');
    }
    else {
        if (!pageRepoMatch[1]) {
            failures.push('Missing pr_type : "<repo_link>" field in PR body.');
        }
        else {
            if (pageRepoMatch[1]) {
                const rawValue = pageRepoMatch[1].trim();
                if (/^<?repo_link>?$/i.test(rawValue)) {
                    failures.push('Replace placeholder value in "site_repo" field in PR body.');
                }
                const value = unwrapAutolink(rawValue);
                if (!/^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/i.test(value)) {
                    failures.push('"site_repo" should be a GitHub repository URL like <https://github.com/owner/repo>.');
                }
            }
        }
    }
    const siteUrlMatch = body.match(/^\s*-\s*site_url\s*:\s*(.+)\s*$/im);
    if (!siteUrlMatch) {
        failures.push('Missing "site_url : <url_link>" field in PR body.');
    }
    else {
        if (siteUrlMatch[1]) {
            const rawValue = siteUrlMatch[1].trim();
            if (/^<?url_link>?$/i.test(rawValue)) {
                failures.push('Replace placeholder value in "site_url" field.');
            }
            const value = unwrapAutolink(rawValue);
            if (!/^https?:\/\//i.test(value)) {
                failures.push('"page_repo" should be a valid URL starting with http:// or https://. Markdown autolinks like <https://example.com> are allowed.');
            }
        }
    }
    let str = "✅ PR template fields are valid.";
    let ok = true;
    if (failures.length > 0) {
        str = `❌ PR template validation failed:\n- ${failures.join("\n- ")}`;
        ok = false;
    }
    if (pr_type === undefined) {
        ok = false;
    }
    return {
        status: ok,
        message: str,
        prt: pr_type,
    };
}
class GithubRest {
    _github;
    _owner;
    _repo;
    _pull_number;
    constructor(gh_token, repo_owner, repo_name, pr_number) {
        this._github = getOctokit(gh_token);
        this._owner = repo_owner;
        this._repo = repo_name;
        this._pull_number = parseInt(pr_number, 10);
    }
    async getPr() {
        const { data: pr } = await this._github.rest.pulls.get({
            owner: this._owner,
            repo: this._repo,
            pull_number: this._pull_number,
        });
        return pr;
    }
    async commentToJob(comment_body) {
        const runUrl = `${context.serverUrl}/${this._owner}/${this._repo}/actions/runs/${context.runId}`;
        const { data: comments } = await this._github.rest.issues.listComments({
            owner: this._owner,
            repo: this._repo,
            issue_number: this._pull_number,
        });
        const commentBody = `[BOT] Workflow Report\n\nJob : ${context.job}\nMessage : ${comment_body}\nRun : ${runUrl}`;
        const existing = [...comments].reverse().find((comment) => {
            const body = comment.body || "";
            return (comment.user?.type === "Bot" && body.includes("[BOT] Workflow Report"));
        });
        if (existing) {
            await this._github.rest.issues.updateComment({
                owner: this._owner,
                repo: this._repo,
                comment_id: existing.id,
                body: commentBody,
            });
        }
        else {
            await this._github.rest.issues.createComment({
                owner: this._owner,
                repo: this._repo,
                issue_number: this._pull_number,
                body: commentBody,
            });
        }
    }
    async checkUserLocation() {
        const pr = await this.getPr();
        const username = pr.user.login;
        const { data: user } = await this._github.rest.users.getByUsername({
            username,
        });
        const location = (user.location || "").toLowerCase();
        if (!location.includes("myanmar")) {
            await this.commentToJob(`❌ User ${username} must have location containing "Myanmar".\nCurrent profile location: "${user.location || "(empty)"}"`);
            process.exit(1);
        }
        else {
            await this.commentToJob(`✅ PR user location is valid: ${user.location}`);
            return;
        }
    }
    async checkPrBody() {
        const pr = await this.getPr();
        const body = pr.body || "";
        const checked = checkPrRequestBody(body);
        if (!checked.status) {
            await this.commentToJob(checked.message);
            process.exit(1);
        }
        else {
            await this.commentToJob(checked.message);
            return;
        }
    }
    async getPrType() {
        const pr = await this.getPr();
        let body = pr.body || "";
        body = body.replace(/<!--[\s\S]*?-->/gm, "").trim();
        let pr_type = undefined;
        const prTypeMatch = body.match(/^\s*-\s*pr_type\s*:\s*(.+)\s*$/im);
        if (prTypeMatch) {
            const rawValue = prTypeMatch[1]?.trim();
            if (rawValue && !/^<?type_of_pr>?$/i.test(rawValue)) {
                const value = unwrapAutolink(rawValue);
                if (/^(?:register|update|remove)$/i.test(value)) {
                    pr_type = value;
                }
            }
        }
        return pr_type;
    }
    async getPrUser() {
        const pr = await this.getPr();
        const username = pr.user.login;
        return username;
    }
}
async function checkPrBody(gh_token, repo_owner, repo_name, pr_number) {
    const gh = new GithubRest(gh_token, repo_owner, repo_name, pr_number);
    await gh.checkPrBody();
}
async function checkPrUser(gh_token, repo_owner, repo_name, pr_number) {
    const gh = new GithubRest(gh_token, repo_owner, repo_name, pr_number);
    await gh.checkUserLocation();
}
async function checkEntries(dir, dns_api_token, zone_Id, gh_token, repo_owner, repo_name, pr_number) {
    const gh = new GithubRest(gh_token, repo_owner, repo_name, pr_number);
    const pr_login = await gh.getPrUser();
    const pr_type = (await gh.getPrType());
    const checked = await entry(dir, pr_login, pr_type, dns_api_token, zone_Id);
    if (!checked.status) {
        await gh.commentToJob(checked.message);
        process.exit(1);
    }
    else {
        await gh.commentToJob(checked.message);
        return;
    }
}
export { checkEntries, checkPrBody, checkPrUser };
//# sourceMappingURL=index.mjs.map