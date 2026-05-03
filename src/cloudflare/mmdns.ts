import { files } from "@suseejs/files";
import Cloudflare from "cloudflare";

class MmDNS {
  private _cf: Cloudflare;
  private _zoneId: string;
  private _errors: string[];
  private _str: string;
  constructor(api_token: string, zone_Id: string) {
    this._cf = new Cloudflare({ apiToken: api_token });
    this._zoneId = zone_Id;
    this._errors = [];
    this._str = `✅ All dns process are passed`;
  }
  async list(): Promise<Cloudflare.DNS.Records.RecordResponse[]> {
    const records = await this._cf.dns.records.list({ zone_id: this._zoneId });
    return records.result;
  }
  async writeList(filePath: string) {
    const dnsList = await this.list();
    await files.writeFile(filePath, JSON.stringify(dnsList));
  }
  async createCname(subdomain: string, cnameValue: string, cfp = false) {
    const sub_domain = `${subdomain}.mmdevs.org`;
    const record = await this._cf.dns.records.create({
      zone_id: this._zoneId,
      type: "CNAME",
      name: sub_domain,
      content: cnameValue,
      ttl: 1,
      proxied: cfp,
    });
    this._str = `✅ Created subdomain : ${sub_domain} with ID : ${record.id}`;
    return this;
  }
  async findRecord(subdomain: string) {
    const sub_domain = `${subdomain}.mmdevs.org`;
    const recordsList = await this.list();
    const found = recordsList.find(
      (rec) => rec.content && rec.name === sub_domain,
    );
    const exists = !!found;
    return { exists, record: found };
  }
  async updateCname(subdomain: string, cnameValue: string) {
    const sub_domain = `${subdomain}.mmdevs.org`;
    const found = await this.findRecord(subdomain);
    if (!found.exists || !found.record) {
      this._errors.push(
        `Records for "${sub_domain}" dose not exists on DNS or error on search`,
      );
    }
    if (this._errors.length > 0) {
      return this;
    }
    if (found.record) {
      if (found.record.content && found.record.content === cnameValue) {
        this._str = `Cname target want to update "${cnameValue}" is up to date`;
        return this;
      } else {
        await this._cf.dns.records.update(found.record.id, {
          zone_id: this._zoneId,
          type: "CNAME",
          name: found.record.name,
          content: cnameValue,
          ttl: 1,
          proxied: found.record.proxied ?? false,
        });
        this._str = `✅ Updated subdomain : "${found.record.name}" with CNAME target : "${cnameValue}"`;
        return this;
      }
    } else {
      return this;
    }
  }
  async removeCname(subdomain: string) {
    const sub_domain = `${subdomain}.mmdevs.org`;
    const found = await this.findRecord(subdomain);
    if (!found.exists || !found.record) {
      this._errors.push(
        `Records for "${sub_domain}" dose not exists on DNS or error on search`,
      );
    }
    if (this._errors.length > 0) {
      return this;
    }
    if (found.record) {
      await this._cf.dns.records.delete(found.record.id, {
        zone_id: this._zoneId,
      });
      this._str = `✅ Removed subdomain : "${found.record.name}"`;
      return this;
    } else {
      return this;
    }
  }
  public get message() {
    if (this._errors.length > 0) {
      this._str = `❌ Fail dns processes :\n${this._errors.map((m) => `- ${m}\n`)}`;
    }
    return this._str.trimEnd();
  }
}

export const mmdns = (api_token: string, zone_Id: string) =>
  new MmDNS(api_token, zone_Id);
