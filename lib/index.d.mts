declare function checkPrBody(gh_token: string, repo_owner: string, repo_name: string, pr_number: string): Promise<void>;
declare function checkPrUser(gh_token: string, repo_owner: string, repo_name: string, pr_number: string): Promise<void>;
declare function checkEntries(gh_token: string, repo_owner: string, repo_name: string, pr_number: string): any;
export { checkEntries, checkPrBody, checkPrUser };
