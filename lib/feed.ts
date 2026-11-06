import { getCompanyName, getFeedEmail } from "./config";
import type { Job } from "./types";
import { jobFeedUrl, publicSiteOrigin } from "./urls";

function cdata(value: string): string {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function tag(name: string, value: string): string {
  return `    <${name}>${cdata(value)}</${name}>`;
}

function openJobs(jobs: Job[]): Job[] {
  return jobs.filter((job) => job.status === "open");
}

function payBounds(pay: string): { min: string; max: string } | undefined {
  const match = pay.match(/^\$(\d+(?:\.\d{2})?)(?: - \$(\d+(?:\.\d{2})?))? per /);
  if (!match) return undefined;
  return { min: match[1], max: match[2] ?? match[1] };
}

export function buildFeedXml(jobs: Job[], siteUrl: string): string {
  const company = getCompanyName();
  const email = getFeedEmail();
  const jobNodes = openJobs(jobs)
    .map((job) => {
      const fields: Array<[string, string]> = [
        ["title", job.title],
        ["date", job.date_posted],
        ["referencenumber", job.referencenumber],
        ["requisitionid", job.requisitionid],
        ["url", jobFeedUrl(siteUrl, job.referencenumber, "indeed")],
        ["company", company],
        ["city", job.city],
        ["state", job.state],
        ["country", job.country],
        ["postalcode", job.postalcode],
        ["email", email],
        ["description", job.description_html],
        ["jobtype", job.jobtype],
        ["salary", job.pay],
      ];
      return `  <job>\n${fields.map(([name, value]) => tag(name, value)).join("\n")}\n  </job>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>${cdata(company)}</publisher>
  <publisherurl>${cdata(publicSiteOrigin(siteUrl))}</publisherurl>
${jobNodes}
</source>
`;
}

export function buildAdzunaFeedXml(jobs: Job[], siteUrl: string): string {
  const company = getCompanyName();
  const jobNodes = openJobs(jobs)
    .map((job) => {
      const bounds = payBounds(job.pay);
      const fields = [
        tag("title", job.title),
        tag("id", job.referencenumber),
        tag("description", job.description_html),
        tag("url", jobFeedUrl(siteUrl, job.referencenumber, "adzuna")),
        tag("location", `${job.city}, ${job.state}`),
        tag("postcode", job.postalcode),
        tag("country", job.country),
        tag("salary", job.pay),
        tag("salary_currency", "USD"),
        tag("company", company),
        tag("category", "Retail"),
        tag("contract_type", "contract"),
        tag("date", job.date_posted),
      ];
      if (bounds) {
        fields.push(`    <salary_min>${bounds.min}</salary_min>`);
        fields.push(`    <salary_max>${bounds.max}</salary_max>`);
      }
      return `  <job>\n${fields.join("\n")}\n  </job>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<jobs>
${jobNodes}
</jobs>
`;
}

export function buildZipRecruiterFeedXml(jobs: Job[], siteUrl: string): string {
  const company = getCompanyName();
  const jobNodes = openJobs(jobs)
    .map((job) => {
      const bounds = payBounds(job.pay);
      const fields = [
        tag("referencenumber", job.referencenumber),
        tag("title", job.title),
        tag("date", `${job.date_posted}T00:00:00Z`),
        tag("url", jobFeedUrl(siteUrl, job.referencenumber, "ziprecruiter")),
        tag("company", company),
        tag("city", job.city),
        tag("state", job.state),
        tag("country", job.country),
        tag("postalcode", job.postalcode),
        tag("description", job.description_html),
        tag("salary", job.pay),
        tag("compensation_currency", "USD"),
      ];
      if (bounds) {
        fields.push(`    <compensation_min>${bounds.min}</compensation_min>`);
        fields.push(`    <compensation_max>${bounds.max}</compensation_max>`);
      }
      return `  <job>\n${fields.join("\n")}\n  </job>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>${cdata(company)}</publisher>
  <publisherurl>${cdata(publicSiteOrigin(siteUrl))}</publisherurl>
${jobNodes}
</source>
`;
}
