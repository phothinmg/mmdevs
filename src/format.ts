import type { EntryObject } from "./types.js";

export function checkEntryFormats(registered: string[], reserved: string[]) {
  let status = true;
  const message: { passed: string; error: string } = {
    passed: `Entry format checks are passed.`,
    error: "",
  };
  // regexp
  const githubRegex = /(^|\.)github\.io(?:\/.*)?$/i;
  const vercelRegex = /(^|\.)vercel-dns-[0-9]+\.com(?:\/.*)?$/i;
  const vercelRegexOld = /^cname\.vercel-dns\.com(?:\/.*)?$/i;
  const subDomainFormatRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

  const modified = (obj: EntryObject) => {
    // cname
    const cnGH = githubRegex.test(obj.cname_value);
    const vcNew = vercelRegex.test(obj.cname_value);
    const vcOld = vercelRegexOld.test(obj.cname_value);
    if (!cnGH && !vcNew && !vcOld) {
      status = false;
      message.error = `Invalid cname target , {${obj.sub_domain} : ${obj.cname_value}`;
      return { status, message };
    }
    return { status, message };
  };
  const added = (obj: EntryObject) => {
    if (registered.includes(obj.sub_domain)) {
      status = false;
      message.error = `Subdomain "${obj.sub_domain}" already registered by other user, please try with different name.`;
      return { status, message };
    }
    if (reserved.includes(obj.sub_domain)) {
      status = false;
      message.error = `Subdomain "${obj.sub_domain}" is reserved by "MMDEVS.ORG", please try with different name.`;
      return { status, message };
    }
    if (!subDomainFormatRegex.test(obj.sub_domain)) {
      status = false;
      message.error = `Invalid subdomain format "${obj.sub_domain}"`;
      return { status, message };
    }
    return { status, message };
  };
  return { modified, added };
}
