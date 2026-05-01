import { Octokit } from "@octokit/core";

class PrClient {
  private _repo_owner: string;
  private _repo_name: string;
  private _pr_number: string;
  private _octokit: Octokit;
  constructor(
    gh_token: string,
    repo_owner: string,
    repo_name: string,
    pr_number: string,
  ) {
    this._repo_owner = repo_owner;
    this._repo_name = repo_name;
    this._pr_number = pr_number;
    this._octokit = new Octokit({ auth: gh_token });
  }
  private async _pr() {
    // Use the PR number passed from the workflow context
    const { data: pr } = await this._octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner: this._repo_owner,
        repo: this._repo_name,
        pull_number: parseInt(this._pr_number, 10),
        headers: {
          "X-GitHub-Api-Version": "2026-03-10",
        },
      },
    );
    return pr;
  }
  async prInfo() {
    const pr = await this._pr();
    const pr_userName = pr.user.login;
    const { data: usr } = await this._octokit.request("GET /users/{username}", {
      username: pr_userName,
      headers: {
        "X-GitHub-Api-Version": "2026-03-10",
      },
    });
    const body = pr.body ?? "";
    const pullNumber = pr.number;
    const login = pr_userName;
    const isMM = () => (usr.location || "").toLowerCase().includes("myanmar");
    return { body, pullNumber, login, isMM };
  }

  async createComment(body: string) {
    const text = body.trim();
    if (!text) {
      throw new Error("Comment body cannot be empty");
    }

    const { data: comment } = await this._octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner: this._repo_owner,
        repo: this._repo_name,
        issue_number: parseInt(this._pr_number, 10),
        body: text,
        headers: {
          "X-GitHub-Api-Version": "2026-03-10",
        },
      },
    );

    return comment;
  }

  async createReviewComment(params: {
    body: string;
    path: string;
    line: number;
    side?: "LEFT" | "RIGHT";
    commitId?: string;
  }) {
    const text = params.body.trim();
    if (!text) {
      throw new Error("Review comment body cannot be empty");
    }
    if (!params.path.trim()) {
      throw new Error("Review comment path cannot be empty");
    }
    if (params.line < 1) {
      throw new Error("Review comment line must be >= 1");
    }

    const pr = await this._pr();
    const commitId = params.commitId ?? pr.head.sha;

    const { data: reviewComment } = await this._octokit.request(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments",
      {
        owner: this._repo_owner,
        repo: this._repo_name,
        pull_number: parseInt(this._pr_number, 10),
        body: text,
        commit_id: commitId,
        path: params.path,
        line: params.line,
        side: params.side ?? "RIGHT",
        headers: {
          "X-GitHub-Api-Version": "2026-03-10",
        },
      },
    );

    return reviewComment;
  }
}

export { PrClient };
