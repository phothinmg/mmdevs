import type Cloudflare from "cloudflare";

export type DNSObject = Cloudflare.DNS.Records.RecordResponse;
export type DNSObjects = DNSObject[];

export type PRType = "register" | "update" | "remove";

export interface Subdomain {
	sub_domain: string;
}

export interface CnameObject extends Subdomain {
	cname_value: string;
}
export interface EntriesObject extends CnameObject {
	remove: boolean;
	cfp: boolean;
}
export interface RawObject extends EntriesObject {
	$schema: string;
}
export interface SubdomainObject extends EntriesObject {
	github_username: string;
	register_date: string | Date;
}
