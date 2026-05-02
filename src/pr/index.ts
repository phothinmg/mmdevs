import type { PRType } from "../types.js";
import { PrClient } from "./octokit.js";
import { checkPrRequestBody } from "./pr_body.js";

export async function checkUserLocation(
  gh_token: string,
  repo_owner: string,
  repo_name: string,
  pr_number: string,
): Promise<{
  status: boolean;
  message: string;
}> {
  let str = `[USER:OK] Github user location check passed`;
  const prClient = new PrClient(gh_token, repo_owner, repo_name, pr_number);
  const info = await prClient.prInfo();
  const is_mm = info.isMM();
  if (is_mm) {
    str = `[USER:FAIL] Github user location check failed`;
  }
  return {
    status: is_mm,
    message: str,
  };
}
export async function checkPrBody(
  gh_token: string,
  repo_owner: string,
  repo_name: string,
  pr_number: string,
): Promise<{
  status: boolean;
  message: string;
}> {
  const prClient = new PrClient(gh_token, repo_owner, repo_name, pr_number);
  const info = await prClient.prInfo();
  const body = info.body;
  const result = checkPrRequestBody(body);
  return {
    status: result.status,
    message: result.message,
  };
}
export async function getPrType(
  gh_token: string,
  repo_owner: string,
  repo_name: string,
  pr_number: string,
) {
  const prClient = new PrClient(gh_token, repo_owner, repo_name, pr_number);
  const info = await prClient.prInfo();
  const body = info.body;
  return checkPrRequestBody(body).prt as PRType;
}

export async function getPrUser(
  gh_token: string,
  repo_owner: string,
  repo_name: string,
  pr_number: string,
) {
  const prClient = new PrClient(gh_token, repo_owner, repo_name, pr_number);
  const info = await prClient.prInfo();
  return info.login;
}
