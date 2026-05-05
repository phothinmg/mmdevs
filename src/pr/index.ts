import { getOctokit, context } from "@actions/github";
import path from "node:path";
import { checkPrRequestBody } from "./pr_body.js";
import type {
  RawSubdomains,
  Subdomains,
  SubdomainsJsonFile,
  DataBaseJsonFile,
  DataBaseJsonObject,
  TempDataFile,
  TempDataFiles,
} from "../types.js";
import {
  readCacheSubdomainFile,
  writeCacheSubdomainFile,
  readCacheDataBaseFile,
  writeCacheDataBaseFile,
  writeCacheTempDataFile,
} from "../cache_files.js";

class GithubPR {
  private _github: import("@octokit/core").Octokit &
    import("@octokit/plugin-rest-endpoint-methods").Api & {
      paginate: import("@octokit/plugin-paginate-rest").PaginateInterface;
    };
  private _owner: string;
  private _repo: string;
  private _pull_number: number;

  constructor(
    gh_token: string,
    repo_owner: string,
    repo_name: string,
    pr_number: string,
  ) {
    this._github = getOctokit(gh_token);
    this._owner = repo_owner;
    this._repo = repo_name;
    this._pull_number = parseInt(pr_number, 10);
  }
  private async _getPr() {
    const { data: pr } = await this._github.rest.pulls.get({
      owner: this._owner,
      repo: this._repo,
      pull_number: this._pull_number,
    });
    return pr;
  }
  private async _getPrUser() {
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
  async commentToJob(comment_body: string, error: boolean) {
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
      return (
        comment.user?.type === "Bot" &&
        body.includes(`[${symbol}] Workflow ${isError} Report`)
      );
    });
    if (existing) {
      await this._github.rest.issues.updateComment({
        owner: this._owner,
        repo: this._repo,
        comment_id: existing.id,
        body: commentBody,
      });
    } else {
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
      await this.commentToJob(
        `❌ User ${username} must have location containing "Myanmar".\nCurrent profile location: "${user.location || "(empty)"}"`,
        true,
      );
      process.exit(1);
    } else {
      await this.commentToJob(
        `✅ PR user location is valid: ${user.location}`,
        false,
      );
      return;
    }
  }
  async checkPrBody() {
    const pr = await this._getPr();
    const body = pr.body || "";
    const checked = checkPrRequestBody(body);
    if (!checked.status) {
      await this.commentToJob(
        checked.message.error.map((m) => `- ${m}`).join("\'n"),
        true,
      );
      process.exit(1);
    } else {
      await this.commentToJob(checked.message.passed, false);
      return;
    }
  }
  private _checkFormats(obj: Subdomains) {
    let status = true;
    let message = {
      passed: "✅ Cname and subdomain check passed",
      error: "",
    };
    // regexp
    const githubRegex = /(^|\.)github\.io(?:\/.*)?$/i;
    const vercelRegex = /(^|\.)vercel-dns-[0-9]+\.com(?:\/.*)?$/i;
    const vercelRegexOld = /^cname\.vercel-dns\.com(?:\/.*)?$/i;
    const subDomainFormatRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
    const cnameCheck = () => {
      // cname
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
  async checkPrFilesStatus(allowedStatuses: Set<string>) {
    let status = true;
    let message = {
      passed: `✅ PR files check passed`,
      error: "",
    };
    const pr_file = await this.getPRFiles();
    const filteredFiles = pr_file.filter(
      (file) =>
        !allowedStatuses.has(file.status) ||
        (allowedStatuses.has(file.status) &&
          !file.filename.startsWith("subdomains/")),
    );
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
    let content = {} as Subdomains;
    const pr_files = await this.getPRFiles();
    const allowedStatuses = new Set(["added", "modified"]);
    const filesStatus = await this.checkPrFilesStatus(allowedStatuses);
    if (!filesStatus.status) {
      await this.commentToJob(filesStatus.message.error, true);
      process.exit(1);
    }
    // filter change files from subdomains directory
    const filteredFiles = pr_files.filter(
      (f) =>
        f.filename.startsWith("subdomains/") &&
        (path.posix.extname(f.filename) === ".json" ||
          path.posix.extname(f.filename) === ".jsonc") &&
        path.posix.basename(f.filename) !== "example.jsonc" &&
        allowedStatuses.has(f.status),
    );
    if (filteredFiles.length === 0) {
      await this.commentToJob(`❌ No file changed is your PR`, true);
      process.exit(1);
    }
    if (filteredFiles.length > 1) {
      await this.commentToJob(
        `❌ Found more than one or more files changed in "subdomains".\nWe allowed one register/update/remove per PR.`,
        true,
      );
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
        const fileContent = JSON.parse(file_content) as RawSubdomains;
        content.sub_domain = fileContent.sub_domain;
        content.cname_value = fileContent.cname_value;
        content.request_type = fileContent.request_type;
        content.cfp = false;
        content.status = changedFile.status as "added" | "modified";
      }
      // ##
      const sub_domains = await readCacheSubdomainFile();
      const pr_user = await this._getPrUser();
      // ##
      if (Object.keys(content).length !== 0) {
        const formatChecked = this._checkFormats(content);
        const dateNow = new Date();
        if (content.status === "added") {
          if (content.request_type !== "register") {
            await this.commentToJob(
              `❌ Your request_type is ${content.request_type}, but found in PR file type is ${changedFile.status}`,
              true,
            );
            process.exit(1);
          }

          if (sub_domains.registered.includes(content.sub_domain)) {
            await this.commentToJob(
              `❌ ${content.sub_domain} is already registered by a user, please try with other subdomain name.`,
              true,
            );
            process.exit(1);
          }
          if (sub_domains.reserved.includes(content.sub_domain)) {
            await this.commentToJob(
              `❌ ${content.sub_domain} is reserved subdomain by MMDEVS.ORG, please try with other subdomain name.`,
              true,
            );
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
          const new_sub_domains: SubdomainsJsonFile = {
            registered: [content.sub_domain, ...sub_domains.registered],
            reserved: sub_domains.reserved,
          };
          await writeCacheSubdomainFile(new_sub_domains);
          const dataBaseObjet: DataBaseJsonObject = {
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
          const temDataObject: TempDataFile = {
            sub_domain: content.sub_domain,
            cname_value: content.cname_value,
            request_type: content.request_type,
          };
          await writeCacheTempDataFile(temDataObject);
          await this.commentToJob(filesStatus.message.passed, false);
          return;
          // type added
        }
        if (content.status === "modified") {
          if (content.request_type === "register") {
            await this.commentToJob(
              `❌ Your request_type is ${content.request_type}, but found in PR file type is ${changedFile.status}`,
              true,
            );
            process.exit(1);
          }
          const oldData = await readCacheDataBaseFile();
          const foundKey = Object.keys(oldData).find(
            (k) => k === content.sub_domain,
          );
          if (!foundKey) {
            await this.commentToJob(
              `❌ Subdomain ${content.sub_domain} want to modified dose not exists`,
              true,
            );
            process.exit(1);
          }
          const foundObject = oldData[foundKey];
          if (!foundObject) {
            await this.commentToJob(
              `❌ Subdomain ${content.sub_domain} want to modified dose not exists`,
              true,
            );
            process.exit(1);
          }
          const isRight =
            pr_user.id === foundObject.github_id &&
            content.sub_domain === foundKey &&
            pr_user.login === foundObject.github_user;
          if (!isRight) {
            await this.commentToJob(
              `❌ You have not right to modified subdomain ${content.sub_domain}`,
              true,
            );
            process.exit(1);
          }
          const newFoundObject: DataBaseJsonObject = {
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
          const temDataObject: TempDataFile = {
            sub_domain: content.sub_domain,
            cname_value: content.cname_value,
            request_type: content.request_type,
          };
          await writeCacheTempDataFile(temDataObject);
          await this.commentToJob(filesStatus.message.passed, false);
          return;
          // type modified
        }
        // not empty object
      } else {
        await this.commentToJob(
          `❌ Unknown error found to collect PR file data`,
          true,
        );
        process.exit(1);
      }
      // changeFile
    } else {
      await this.commentToJob(
        `❌ Unknown error found to collect PR file data`,
        true,
      );
      process.exit(1);
    }
  }
}

export { GithubPR };
