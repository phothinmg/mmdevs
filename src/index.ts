import { GithubPR } from "./pr/index.js";

async function checkPrBody(
  gh_token: string,
  repo_owner: string,
  repo_name: string,
  pr_number: string,
): Promise<void> {
  const gh = new GithubPR(gh_token, repo_owner, repo_name, pr_number);
  await gh.checkPrBody();
}
async function checkPrUser(
  gh_token: string,
  repo_owner: string,
  repo_name: string,
  pr_number: string,
): Promise<void> {
  const gh = new GithubPR(gh_token, repo_owner, repo_name, pr_number);
  await gh.checkUserLocation();
}

async function checkEntries(
  gh_token: string,
  repo_owner: string,
  repo_name: string,
  pr_number: string,
) {
  const gh = new GithubPR(gh_token, repo_owner, repo_name, pr_number);
  await gh.managePrFiles();
}

export { checkEntries, checkPrBody, checkPrUser };
