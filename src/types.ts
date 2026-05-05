import type Cloudflare from "cloudflare";

export type DNSObject = Cloudflare.DNS.Records.RecordResponse;
export type DNSObjects = DNSObject[];

// export type PRType = "register" | "update" | "remove";

// export interface Subdomain {
//   sub_domain: string;
// }

// export interface CnameObject extends Subdomain {
//   cname_value: string;
// }
// export interface EntriesObject extends CnameObject {
//   remove: boolean;
//   cfp: boolean;
// }
// export interface RawObject extends EntriesObject {
//   $schema: string;
// }
// export interface SubdomainObject extends EntriesObject {
//   github_username: string;
//   register_date: string | Date;
// }
// last api
export interface RawSubdomains {
  $schema: string;
  sub_domain: string;
  cname_value: string;
  request_type: "register" | "update" | "remove";
  cfp?: boolean;
}
export interface Subdomains {
  sub_domain: string;
  cname_value: string;
  request_type: "register" | "update" | "remove";
  cfp: boolean;
  status: "added" | "modified";
}
export interface SubdomainsJsonFile {
  registered: string[];
  reserved: string[];
}
export type DataBaseJsonObject = {
  github_user: string;
  github_name: string;
  github_id: number;
  cname_value: string;
  cnameHistory: { value: string; date: Date }[];
  registeredDate: Date;
  lastUpdatedDate: Date;
  isDNSRecorded: boolean;
};
export type DataBaseJsonFile = Record<string, DataBaseJsonObject>;
export type TempDataFile = {
  sub_domain: string;
  cname_value: string;
  request_type: "register" | "update" | "remove";
};
export type TempDataFiles = TempDataFile[];
