export type RequestType = "register" | "update" | "remove";
export type CacheSubdomainFile = {
	registered: string[];
	reserved: string[];
};
export type CacheDatabaseObject = {
	github_id: number;
	github_user: string;
	cname_value: string;
	cname_history: { value: string; date: Date }[];
	created_on: Date;
	modified_on: Date;
	dns_recorded: boolean;
	last_request_type: RequestType;
	json_file_name: string;
};
export type CachePrJsonFile = {
	json_files: string[];
};

export type CacheDatabaseFile = Record<string, CacheDatabaseObject>;
export type CacheTempDataObject = {
	sub_domain: string;
	cname_value: string;
	request_type: RequestType;
};
export type CacheTempDataFile = {
	temp_object: CacheTempDataObject[];
};
export type EntryObject = {
	sub_domain: string;
	cname_value: string;
	request_type: RequestType;
	cfp: boolean;
};
export type RawEntryObject = {
	$schema: string;
	sub_domain: string;
	cname_value: string;
	request_type: RequestType;
	cfp?: boolean;
};
