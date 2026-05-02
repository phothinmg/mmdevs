declare function checkUserLocation(gh_token: string, repo_owner: string, repo_name: string, pr_number: string): Promise<{
    status: boolean;
    message: string;
}>;
declare function checkPrBody(gh_token: string, repo_owner: string, repo_name: string, pr_number: string): Promise<{
    status: boolean;
    message: string;
}>;
declare function checkEntries(dir: string, dns_api_token: string, zone_Id: string, gh_token: string, repo_owner: string, repo_name: string, pr_number: string): Promise<{
    status: boolean;
    message: string;
}>;
export { checkEntries, checkPrBody, checkUserLocation };
