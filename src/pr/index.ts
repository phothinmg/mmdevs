import { getOctokit, context } from "@actions/github";
import { checkPrRequestBody, unwrapAutolink } from "./pr_body.js";
import type { PRType } from "../types.js";

class GithubRest {
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
  async getPr() {
    const { data: pr } = await this._github.rest.pulls.get({
      owner: this._owner,
      repo: this._repo,
      pull_number: this._pull_number,
    });
    return pr;
  }
  async commentToJob(comment_body: string) {
    const runUrl = `${context.serverUrl}/${this._owner}/${this._repo}/actions/runs/${context.runId}`;
    const { data: comments } = await this._github.rest.issues.listComments({
      owner: this._owner,
      repo: this._repo,
      issue_number: this._pull_number,
    });
    const commentBody = `[BOT] Workflow Report\n\nJob : ${context.job}\nMessage : ${comment_body}\nRun : ${runUrl}`;
    const existing = [...comments].reverse().find((comment) => {
      const body = comment.body || "";
      return (
        comment.user?.type === "Bot" && body.includes("[BOT] Workflow Report")
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
    const pr = await this.getPr();
    const username = pr.user.login;
    const { data: user } = await this._github.rest.users.getByUsername({
      username,
    });
    const location = (user.location || "").toLowerCase();
    if (!location.includes("myanmar")) {
      await this.commentToJob(
        `❌ User ${username} must have location containing "Myanmar".\nCurrent profile location: "${user.location || "(empty)"}"`,
      );
      process.exit(1);
    } else {
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
    } else {
      await this.commentToJob(checked.message);
      return;
    }
  }
  async getPrType() {
    const pr = await this.getPr();
    let body = pr.body || "";
    body = body.replace(/<!--[\s\S]*?-->/gm, "").trim();
    let pr_type: PRType | undefined = undefined;
    const prTypeMatch = body.match(/^\s*-\s*pr_type\s*:\s*(.+)\s*$/im);
    if (prTypeMatch) {
      const rawValue = prTypeMatch[1]?.trim();
      if (rawValue && !/^<?type_of_pr>?$/i.test(rawValue)) {
        const value = unwrapAutolink(rawValue);
        if (/^(?:register|update|remove)$/i.test(value)) {
          pr_type = value as PRType;
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

export { GithubRest };
