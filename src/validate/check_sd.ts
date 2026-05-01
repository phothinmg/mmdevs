import type { CnameObject, Subdomain } from "../types.js";
import { reservedSubdomains } from "./reserve.js";

export async function checkSubdomainsObject(ob: CnameObject, names?: string[]) {
	let ok = true;
	// regexp
	const githubRegex = /(^|\.)github\.io(?:\/.*)?$/i;
	const vercelRegex = /(^|\.)vercel-dns-[0-9]+\.com(?:\/.*)?$/i;
	const vercelRegexOld = /^cname\.vercel-dns\.com(?:\/.*)?$/i;
	const subDomainFormatRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
	// errors
	const cnameError: CnameObject[] = [];
	const formatError: Subdomain[] = [];
	const reservedError: Subdomain[] = [];
	const registeredError: Subdomain[] = [];
	const errorLines: string[] = [];

	// cname
	const cnGH = githubRegex.test(ob.cname_value);
	const vcNew = vercelRegex.test(ob.cname_value);
	const vcOld = vercelRegexOld.test(ob.cname_value);
	if (!cnGH && !vcNew && !vcOld) {
		cnameError.push({ sub_domain: ob.sub_domain, cname_value: ob.cname_value });
	}
	// subdomain format
	if (!subDomainFormatRegex.test(ob.sub_domain)) {
		formatError.push({ sub_domain: ob.sub_domain });
	}
	// reserved subdomain
	if (reservedSubdomains.includes(ob.sub_domain)) {
		reservedError.push({ sub_domain: ob.sub_domain });
	}
	// registered subdomain
	if (names?.includes(ob.sub_domain)) {
		registeredError.push({ sub_domain: ob.sub_domain });
	}

	if (cnameError.length > 0) {
		errorLines.push(
			`Invalid "cname_value":\n${cnameError.map((cn) => `- ${cn.sub_domain} : ${cn.cname_value}\n`).join("")}\n`,
		);
	}
	if (formatError.length > 0) {
		errorLines.push(
			`Invalid subdomain format:\n${formatError.map((cn) => `- ${cn.sub_domain} is not a valid subdomain format.\n`).join("")}\n`,
		);
	}
	if (reservedError.length > 0) {
		errorLines.push(
			`Reserved subdomain detected:\n${reservedError.map((cn) => `- ${cn.sub_domain} is a reserved subdomain.\n`).join("")}\n`,
		);
	}
	if (registeredError.length > 0) {
		errorLines.push(
			`Subdomain already registered:\n${registeredError.map((cn) => `- ${cn.sub_domain} is a registered subdomain.\n`).join("")}\n`,
		);
	}
	if (errorLines.length > 0) {
		ok = false;
	}
	return {
		status: ok,
		errors: errorLines,
	};
}
