import path from "node:path";
import { context, getOctokit } from "@actions/github";
import { files } from "@suseejs/files";
function checkPrRequestBody(body) {
    let status = true;
    let message = {
        passed: `✅ PR body checks are passed.`,
        error: [],
    };
    body = body.replace(/<!--[\s\S]*?-->/gm, "").trim();
    const unwrapAutolink = (value) => value.replace(/^<([^>]+)>$/, "$1").trim();
    const tncRegexp = /^\s*1\.\s*\[(\s*|x|X)?\]\s*I have read and accepted the \[Terms and Conditions\]\(https:\/\/github\.com\/phothinmg\/mmdevs\.org\/wiki\/Terms-and-Conditions\)\s*$/m;
    const rcRegexp = /^\s*2\.\s*\[(\s*|x|X)?\]\s*There is reasonable content on the page\s*$/m;
    const repoUrlRegexp = /^\s*3\.\s*Host repo of my page is\s*(.+)\s*$/m;
    const pageUrlRegexp = /^\s*4\.\s*The site content can be seen at\s*(.+)\s*$/m;
    const tncMatch = body.match(tncRegexp);
    const rcMatch = body.match(rcRegexp);
    const repoMatch = body.match(repoUrlRegexp);
    const pageMatch = body.match(pageUrlRegexp);
    if (!tncMatch) {
        status = false;
        message.error.push(`❌ "Terms and Conditions" line is missing in PR body.`);
    }
    if (!rcMatch) {
        status = false;
        message.error.push(`❌ "There is reasonable content on the page" line is missing in PR body.`);
    }
    if (!repoMatch) {
        status = false;
        message.error.push(`❌ "Host repo of my page is" line is missing in PR body.`);
    }
    if (!pageMatch) {
        status = false;
        message.error.push(`❌ "Host repo of my page is" line is missing in PR body.`);
    }
    if (tncMatch && (!tncMatch[1] || (tncMatch[1] && !/x/i.test(tncMatch[1])))) {
        status = false;
        message.error.push(`❌ In "Terms and Conditions" line need check([x])`);
    }
    if (rcMatch && (!rcMatch[1] || (rcMatch[1] && !/x/i.test(rcMatch[1])))) {
        status = false;
        message.error.push(`❌ In "There is reasonable content on the page" line need check([x])`);
    }
    const repoUrlRawValue = repoMatch && repoMatch[1]?.trim();
    if (repoUrlRawValue) {
        if (/^<?repo_url>?$/i.test(repoUrlRawValue)) {
            status = false;
            message.error.push(`❌ Replace placeholder value "<repo_url>" at "Host repo of my page is" line in PR body.`);
        }
        const value = unwrapAutolink(repoUrlRawValue);
        if (!/^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/i.test(value)) {
            status = false;
            message.error.push(`❌ "<repo_url>" at "Host repo of my page is" line in PR body should be a GitHub repository URL like <https://github.com/{owner}/{repo}>.`);
        }
    }
    const pageUrlValue = pageMatch && pageMatch[1]?.trim();
    if (pageUrlValue) {
        if (/^<?site_url>?$/i.test(pageUrlValue)) {
            status = false;
            message.error.push(`❌ Replace placeholder value "<site_url>" at "There is reasonable content on the page" line in PR body.`);
        }
        const value = unwrapAutolink(pageUrlValue);
        if (!/^https?:\/\//i.test(value)) {
            status = false;
            message.error.push(`❌ "<site_url>" at "There is reasonable content on the page" line in PR body should be a valid URL starting with http:// or https://. Markdown autolinks like <https://example.com> are allowed.`);
        }
    }
    return { status, message };
}
const cacheSubdomainJsonPath = "cache/pr/sub_domains.json";
const cacheDataBaseJsonPath = "cache/pr/database.json";
const cacheTempDataPath = "cache/temp/data.json";
async function readCacheTempDataFile() {
    const str = (await files.readFile(cacheTempDataPath)).str;
    return JSON.parse(str);
}
async function writeCacheTempDataFile(obj) {
    const old = await readCacheTempDataFile();
    const newData = [obj, ...old];
    await files.writeFile(cacheTempDataPath, JSON.stringify(newData));
}
async function readCacheDataBaseFile() {
    const str = (await files.readFile(cacheDataBaseJsonPath)).str;
    return JSON.parse(str);
}
async function writeCacheDataBaseFile(key, obj) {
    let json_data = await readCacheDataBaseFile();
    if (!Object.keys(json_data).includes(key)) {
        json_data[key] = obj;
    }
    const str = JSON.stringify(json_data);
    await files.writeFile(cacheDataBaseJsonPath, str);
}
async function readCacheSubdomainFile() {
    const str = (await files.readFile(cacheSubdomainJsonPath)).str;
    return JSON.parse(str);
}
async function writeCacheSubdomainFile(obj) {
    const str = JSON.stringify(obj);
    await files.writeFile(cacheSubdomainJsonPath, str);
}
class GithubPR {
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
    async _getPr() {
        const { data: pr } = await this._github.rest.pulls.get({
            owner: this._owner,
            repo: this._repo,
            pull_number: this._pull_number,
        });
        return pr;
    }
    async _getPrUser() {
        const pr = await this._getPr();
        return pr.user;
    }
    async getPRFiles() {
        const { data: pr_file } = await this._github.rest.pulls.listFiles({
            owner: this._owner,
            repo: this._repo,
            pull_number: this._pull_number,
            per_page: 100,
        });
        return pr_file;
    }
    async commentToJob(comment_body, error) {
        const isError = error ? "Error" : "Passed";
        const symbol = error ? "❌" : "✅";
        const runUrl = `${context.serverUrl}/${this._owner}/${this._repo}/actions/runs/${context.runId}`;
        const { data: comments } = await this._github.rest.issues.listComments({
            owner: this._owner,
            repo: this._repo,
            issue_number: this._pull_number,
        });
        const commentBody = `[${symbol}] Workflow ${isError} Report\n\nJob : ${context.job}\nMessage : ${comment_body}\nRun : ${runUrl}`;
        const existing = [...comments].reverse().find((comment) => {
            const body = comment.body || "";
            return (comment.user?.type === "Bot" &&
                body.includes(`[${symbol}] Workflow ${isError} Report`));
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
        const pr = await this._getPr();
        const username = pr.user.login;
        const { data: user } = await this._github.rest.users.getByUsername({
            username,
        });
        const location = (user.location || "").toLowerCase();
        if (!location.includes("myanmar")) {
            await this.commentToJob(`❌ User ${username} must have location containing "Myanmar".\nCurrent profile location: "${user.location || "(empty)"}"`, true);
            process.exit(1);
        }
        else {
            await this.commentToJob(`✅ PR user location is valid: ${user.location}`, false);
            return;
        }
    }
    async checkPrBody() {
        const pr = await this._getPr();
        const body = pr.body || "";
        const checked = checkPrRequestBody(body);
        if (!checked.status) {
            await this.commentToJob(checked.message.error.map((m) => `- ${m}`).join("\'n"), true);
            process.exit(1);
        }
        else {
            await this.commentToJob(checked.message.passed, false);
            return;
        }
    }
    _checkFormats(obj) {
        let status = true;
        let message = {
            passed: "✅ Cname and subdomain check passed",
            error: "",
        };
        const githubRegex = /(^|\.)github\.io(?:\/.*)?$/i;
        const vercelRegex = /(^|\.)vercel-dns-[0-9]+\.com(?:\/.*)?$/i;
        const vercelRegexOld = /^cname\.vercel-dns\.com(?:\/.*)?$/i;
        const subDomainFormatRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
        const cnameCheck = () => {
            const cnGH = githubRegex.test(obj.cname_value);
            const vcNew = vercelRegex.test(obj.cname_value);
            const vcOld = vercelRegexOld.test(obj.cname_value);
            if (!cnGH && !vcNew && !vcOld) {
                status = false;
                message.error = `❌  Invalid "cname_value":\n{${obj.sub_domain} : ${obj.cname_value}}`;
            }
            return {
                status,
                message,
            };
        };
        const domainCheck = () => {
            if (!subDomainFormatRegex.test(obj.sub_domain)) {
                status = false;
                message.error = `❌  Invalid "sub_domain":\n${obj.sub_domain}`;
            }
            return {
                status,
                message,
            };
        };
        return { cnameCheck, domainCheck };
    }
    async checkPrFilesStatus(allowedStatuses) {
        let status = true;
        let message = {
            passed: `✅ PR files check passed`,
            error: "",
        };
        const pr_file = await this.getPRFiles();
        const filteredFiles = pr_file.filter((file) => !allowedStatuses.has(file.status) ||
            (allowedStatuses.has(file.status) &&
                !file.filename.startsWith("subdomains/")));
        if (filteredFiles.length > 0) {
            status = false;
            message.error = `❌ The following files changed are not allowed :\n${filteredFiles.map((m) => `- {fileName: ${m.filename},status: ${m.status}\n`)}`;
        }
        return {
            status,
            message,
        };
    }
    async managePrFiles() {
        let content = {};
        const pr_files = await this.getPRFiles();
        const allowedStatuses = new Set(["added", "modified"]);
        const filesStatus = await this.checkPrFilesStatus(allowedStatuses);
        if (!filesStatus.status) {
            await this.commentToJob(filesStatus.message.error, true);
            process.exit(1);
        }
        const filteredFiles = pr_files.filter((f) => f.filename.startsWith("subdomains/") &&
            (path.posix.extname(f.filename) === ".json" ||
                path.posix.extname(f.filename) === ".jsonc") &&
            path.posix.basename(f.filename) !== "example.jsonc" &&
            allowedStatuses.has(f.status));
        if (filteredFiles.length === 0) {
            await this.commentToJob(`❌ No file changed is your PR`, true);
            process.exit(1);
        }
        if (filteredFiles.length > 1) {
            await this.commentToJob(`❌ Found more than one or more files changed in "subdomains".\nWe allowed one register/update/remove per PR.`, true);
            process.exit(1);
        }
        const changedFile = filteredFiles[0];
        if (changedFile) {
            const { data } = await this._github.rest.repos.getContent({
                owner: this._owner,
                repo: this._repo,
                path: changedFile.filename,
                ref: context.payload.pull_request?.head.sha,
            });
            if (!Array.isArray(data) && data.type === "file") {
                const file_content = data.content;
                const fileContent = JSON.parse(file_content);
                content.sub_domain = fileContent.sub_domain;
                content.cname_value = fileContent.cname_value;
                content.request_type = fileContent.request_type;
                content.cfp = false;
                content.status = changedFile.status;
            }
            const sub_domains = await readCacheSubdomainFile();
            const pr_user = await this._getPrUser();
            if (Object.keys(content).length !== 0) {
                const formatChecked = this._checkFormats(content);
                const dateNow = new Date();
                if (content.status === "added") {
                    if (content.request_type !== "register") {
                        await this.commentToJob(`❌ Your request_type is ${content.request_type}, but found in PR file type is ${changedFile.status}`, true);
                        process.exit(1);
                    }
                    if (sub_domains.registered.includes(content.sub_domain)) {
                        await this.commentToJob(`❌ ${content.sub_domain} is already registered by a user, please try with other subdomain name.`, true);
                        process.exit(1);
                    }
                    if (sub_domains.reserved.includes(content.sub_domain)) {
                        await this.commentToJob(`❌ ${content.sub_domain} is reserved subdomain by MMDEVS.ORG, please try with other subdomain name.`, true);
                        process.exit(1);
                    }
                    const domainChecked = formatChecked.domainCheck();
                    if (!domainChecked.status) {
                        await this.commentToJob(domainChecked.message.error, true);
                        process.exit(1);
                    }
                    const cnameChecked = formatChecked.cnameCheck();
                    if (!cnameChecked.status) {
                        await this.commentToJob(cnameChecked.message.error, true);
                        process.exit(1);
                    }
                    const new_sub_domains = {
                        registered: [content.sub_domain, ...sub_domains.registered],
                        reserved: sub_domains.reserved,
                    };
                    await writeCacheSubdomainFile(new_sub_domains);
                    const dataBaseObjet = {
                        github_user: pr_user.login,
                        github_name: pr_user.name ?? "",
                        github_id: pr_user.id,
                        cname_value: content.cname_value,
                        registeredDate: dateNow,
                        lastUpdatedDate: dateNow,
                        isDNSRecorded: false,
                        cnameHistory: [{ value: content.cname_value, date: dateNow }],
                    };
                    await writeCacheDataBaseFile(content.sub_domain, dataBaseObjet);
                    const temDataObject = {
                        sub_domain: content.sub_domain,
                        cname_value: content.cname_value,
                        request_type: content.request_type,
                    };
                    await writeCacheTempDataFile(temDataObject);
                    await this.commentToJob(filesStatus.message.passed, false);
                    return;
                }
                if (content.status === "modified") {
                    if (content.request_type === "register") {
                        await this.commentToJob(`❌ Your request_type is ${content.request_type}, but found in PR file type is ${changedFile.status}`, true);
                        process.exit(1);
                    }
                    const oldData = await readCacheDataBaseFile();
                    const foundKey = Object.keys(oldData).find((k) => k === content.sub_domain);
                    if (!foundKey) {
                        await this.commentToJob(`❌ Subdomain ${content.sub_domain} want to modified dose not exists`, true);
                        process.exit(1);
                    }
                    const foundObject = oldData[foundKey];
                    if (!foundObject) {
                        await this.commentToJob(`❌ Subdomain ${content.sub_domain} want to modified dose not exists`, true);
                        process.exit(1);
                    }
                    const isRight = pr_user.id === foundObject.github_id &&
                        content.sub_domain === foundKey &&
                        pr_user.login === foundObject.github_user;
                    if (!isRight) {
                        await this.commentToJob(`❌ You have not right to modified subdomain ${content.sub_domain}`, true);
                        process.exit(1);
                    }
                    const newFoundObject = {
                        github_user: foundObject.github_user,
                        github_name: foundObject.github_name,
                        github_id: foundObject.github_id,
                        cname_value: content.cname_value,
                        cnameHistory: [
                            { value: content.cname_value, date: dateNow },
                            ...foundObject.cnameHistory,
                        ],
                        registeredDate: foundObject.lastUpdatedDate,
                        lastUpdatedDate: dateNow,
                        isDNSRecorded: foundObject.isDNSRecorded,
                    };
                    await writeCacheDataBaseFile(content.sub_domain, newFoundObject);
                    const temDataObject = {
                        sub_domain: content.sub_domain,
                        cname_value: content.cname_value,
                        request_type: content.request_type,
                    };
                    await writeCacheTempDataFile(temDataObject);
                    await this.commentToJob(filesStatus.message.passed, false);
                    return;
                }
            }
            else {
                await this.commentToJob(`❌ Unknown error found to collect PR file data`, true);
                process.exit(1);
            }
        }
        else {
            await this.commentToJob(`❌ Unknown error found to collect PR file data`, true);
            process.exit(1);
        }
    }
}
async function checkPrBody(gh_token, repo_owner, repo_name, pr_number) {
    const gh = new GithubPR(gh_token, repo_owner, repo_name, pr_number);
    await gh.checkPrBody();
}
async function checkPrUser(gh_token, repo_owner, repo_name, pr_number) {
    const gh = new GithubPR(gh_token, repo_owner, repo_name, pr_number);
    await gh.checkUserLocation();
}
async function checkEntries(dir, dns_api_token, zone_Id, gh_token, repo_owner, repo_name, pr_number) {
    const gh = new GithubPR(gh_token, repo_owner, repo_name, pr_number);
    await gh.managePrFiles();
}
export { checkEntries, checkPrBody, checkPrUser };
//# sourceMappingURL=index.mjs.map