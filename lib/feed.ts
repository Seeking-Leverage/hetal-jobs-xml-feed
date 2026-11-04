import { getCompanyName, getFeedEmail } from "./config";
import type { Job } from "./types";
import { jobFeedUrl } from "./urls";

function cdata(value: string): string {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function jobXml(job: Job, siteUrl: string, company: string, email: string): string {
  const fields: Array<[string, string]> = [
    ["title", job.title],
    ["date", job.date_posted],
    ["referencenumber", job.referencenumber],
    ["requisitionid", job.requisitionid],
    ["url", jobFeedUrl(siteUrl, job.referencenumber)],
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

  const body = fields
    .map(([tag, value]) => `    <${tag}>${cdata(value)}</${tag}>`)
    .join("\n");

  return `  <job>\n${body}\n  </job>`;
}

export function buildFeedXml(jobs: Job[], siteUrl: string): string {
  const company = getCompanyName();
  const email = getFeedEmail();
  const open = jobs.filter((job) => job.status === "open");
  const jobNodes = open
    .map((job) => jobXml(job, siteUrl, company, email))
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>${cdata(company)}</publisher>
  <publisherurl>${cdata(siteUrl)}</publisherurl>
${jobNodes}
</source>
`;
}
