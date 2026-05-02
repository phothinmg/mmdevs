import { entry } from "./entries/index.js";
import {
  checkUserLocation,
  checkPrBody,
  getPrType,
  getPrUser,
} from "./pr/index.js";

async function checkEntries(
  dir: string,
  dns_api_token: string,
  zone_Id: string,
  gh_token: string,
  repo_owner: string,
  repo_name: string,
  pr_number: string,
): Promise<{
  status: boolean;
  message: string;
}> {
  const pr_type = await getPrType(gh_token, repo_owner, repo_name, pr_number);
  const pr_login = await getPrUser(gh_token, repo_owner, repo_name, pr_number);
  const result = await entry(dir, pr_login, pr_type, dns_api_token, zone_Id);
  return result;
}

export { checkEntries, checkPrBody, checkUserLocation };
