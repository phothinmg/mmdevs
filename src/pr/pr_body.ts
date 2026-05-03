import type { PRType } from "../types.js";

export const unwrapAutolink = (value: string) =>
  value.replace(/^<([^>]+)>$/, "$1").trim();

export function checkPrRequestBody(body: string) {
  body = body.replace(/<!--[\s\S]*?-->/gm, "").trim();
  let pr_type: PRType | undefined;
  const failures: string[] = [];
  //1. pr_type
  const prTypeMatch = body.match(/^\s*-\s*pr_type\s*:\s*(.+)\s*$/im);
  if (!prTypeMatch) {
    failures.push('Missing "pr_type : <type_of_pr>" field in PR body.');
  } else {
    if (!prTypeMatch[1]) {
      failures.push('Missing pr_type : "<type_of_pr>" field in PR body.');
    } else {
      const rawValue = prTypeMatch[1].trim();
      if (/^<?type_of_pr>?$/i.test(rawValue)) {
        failures.push(
          'Replace placeholder value in "pr_type" field in PR body.',
        );
      }
      const value = unwrapAutolink(rawValue);
      if (!/^(?:register|update|remove)$/i.test(value)) {
        failures.push(
          `The value of "pr_type" must be one of ("register", "update", "remove").`,
        );
      } else {
        pr_type = value as PRType;
      }
    }
  }
  //2. site_repo
  const pageRepoMatch = body.match(/^\s*-\s*site_repo\s*:\s*(.+)\s*$/im);
  if (!pageRepoMatch) {
    failures.push('Missing "site_repo : <repo_link>" field in PR body.');
  } else {
    if (!pageRepoMatch[1]) {
      failures.push('Missing pr_type : "<repo_link>" field in PR body.');
    } else {
      if (pageRepoMatch[1]) {
        const rawValue = pageRepoMatch[1].trim();
        if (/^<?repo_link>?$/i.test(rawValue)) {
          failures.push(
            'Replace placeholder value in "site_repo" field in PR body.',
          );
        }
        const value = unwrapAutolink(rawValue);
        if (!/^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/i.test(value)) {
          failures.push(
            '"site_repo" should be a GitHub repository URL like <https://github.com/owner/repo>.',
          );
        }
      }
    }
  } // page_repo

  //3. site_url
  const siteUrlMatch = body.match(/^\s*-\s*site_url\s*:\s*(.+)\s*$/im);
  if (!siteUrlMatch) {
    failures.push('Missing "site_url : <url_link>" field in PR body.');
  } else {
    if (siteUrlMatch[1]) {
      const rawValue = siteUrlMatch[1].trim();
      if (/^<?url_link>?$/i.test(rawValue)) {
        failures.push('Replace placeholder value in "site_url" field.');
      }
      const value = unwrapAutolink(rawValue);
      if (!/^https?:\/\//i.test(value)) {
        failures.push(
          '"page_repo" should be a valid URL starting with http:// or https://. Markdown autolinks like <https://example.com> are allowed.',
        );
      }
    }
  } // page_repo
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
