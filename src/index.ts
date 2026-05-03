import { entry } from "./entries/index.js";
import { GithubRest } from "./pr/index.js";
import type { PRType } from "./types.js";

async function checkPrBody(
  gh_token: string,
  repo_owner: string,
  repo_name: string,
  pr_number: string,
): Promise<void> {
  const gh = new GithubRest(gh_token, repo_owner, repo_name, pr_number);
  await gh.checkPrBody();
}
async function checkPrUser(
  gh_token: string,
  repo_owner: string,
  repo_name: string,
  pr_number: string,
): Promise<void> {
  const gh = new GithubRest(gh_token, repo_owner, repo_name, pr_number);
  await gh.checkUserLocation();
}

async function checkEntries(
  dir: string,
  dns_api_token: string,
  zone_Id: string,
  gh_token: string,
  repo_owner: string,
  repo_name: string,
  pr_number: string,
) {
  const gh = new GithubRest(gh_token, repo_owner, repo_name, pr_number);
  const pr_login = await gh.getPrUser();
  const pr_type = (await gh.getPrType()) as PRType;
  const checked = await entry(dir, pr_login, pr_type, dns_api_token, zone_Id);
  if (!checked.status) {
    await gh.commentToJob(checked.message);
    process.exit(1);
  } else {
    await gh.commentToJob(checked.message);
    return;
  }
}

export { checkEntries, checkPrBody, checkPrUser };
