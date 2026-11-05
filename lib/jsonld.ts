import { COMPANY_SITE_URL, getCompanyName } from "./config";
import type { Job } from "./types";
import { jobCanonicalUrl } from "./urls";

const EMPLOYMENT_TYPE = {
  "part-time": "PART_TIME",
  "full-time": "FULL_TIME",
  contract: "CONTRACTOR",
} as const;

const GOOGLE_SALARY_UNITS = new Set(["HOUR", "DAY", "WEEK", "MONTH", "YEAR"]);

/** End of the inclusive expiration date in America/New_York, as ISO 8601. */
export function validThroughTimestamp(isoDate: string): string {
  const sample = new Date(`${isoDate}T16:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
    hour: "2-digit",
  })
    .formatToParts(sample)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = offset?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) {
    throw new Error(`Could not resolve the New York offset for ${isoDate}.`);
  }
  return `${isoDate}T23:59:59${match[1]}${match[2]}:${match[3]}`;
}

export function buildJobPosting(job: Job, siteUrl: string) {
  const company = getCompanyName();
  const url = jobCanonicalUrl(siteUrl, job.referencenumber);

  return {
    "@context": "https://schema.org" as const,
    "@type": "JobPosting" as const,
    title: job.title,
    description: job.description_html,
    datePosted: job.date_posted,
    ...(job.valid_through ? { validThrough: validThroughTimestamp(job.valid_through) } : {}),
    employmentType: EMPLOYMENT_TYPE[job.jobtype],
    directApply: false as const,
    identifier: {
      "@type": "PropertyValue" as const,
      name: company,
      value: job.referencenumber,
    },
    hiringOrganization: {
      "@type": "Organization" as const,
      name: company,
      sameAs: COMPANY_SITE_URL,
      url: COMPANY_SITE_URL,
    },
    jobLocation: {
      "@type": "Place" as const,
      address: {
        "@type": "PostalAddress" as const,
        addressLocality: job.city,
        addressRegion: job.state,
        postalCode: job.postalcode,
        addressCountry: job.country,
      },
    },
    url,
  };
}

type JobPostingSchema = ReturnType<typeof buildJobPosting>;

/**
 * Google's JobPosting rules that this site can check locally.
 * baseSalary is omitted: Google only accepts HOUR, DAY, WEEK, MONTH, and YEAR,
 * and these visits are paid per audit.
 */
export function jobPostingIssues(job: Job, siteUrl: string): string[] {
  const schema: JobPostingSchema = buildJobPosting(job, siteUrl);
  const issues: string[] = [];
  const address = schema.jobLocation.address;
  const canonical = jobCanonicalUrl(siteUrl, job.referencenumber);

  if (!schema.title.trim() || schema.title !== job.title) issues.push("title must match the job title");
  if (schema.description === schema.title) issues.push("description must not be the title");
  if (schema.description !== job.description_html) {
    issues.push("description must be the full HTML shown on the page");
  }
  if (!/<(p|ul|li|br)\b/i.test(schema.description)) {
    issues.push("description must include HTML paragraph breaks");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(schema.datePosted) || schema.datePosted !== job.date_posted) {
    issues.push("datePosted must be the ISO date the job was posted");
  }
  if (!schema.hiringOrganization.name.trim()) issues.push("hiringOrganization.name is required");
  if (schema.hiringOrganization.name !== getCompanyName()) {
    issues.push("hiringOrganization.name must be the company, not the city");
  }
  if (schema.hiringOrganization.sameAs !== COMPANY_SITE_URL) {
    issues.push("hiringOrganization.sameAs must be the company site");
  }
  if (address.addressCountry !== "US" || address.addressCountry !== job.country) {
    issues.push("jobLocation.address.addressCountry must be US");
  }
  if (address.addressLocality !== job.city) issues.push("addressLocality must match the city");
  if (address.addressRegion !== job.state) issues.push("addressRegion must match the state");
  if (address.postalCode !== job.postalcode) issues.push("postalCode must match the ZIP");
  if (schema.url !== canonical || !schema.url.includes(job.referencenumber) || schema.url.includes("?")) {
    issues.push("url must be the permanent canonical job URL");
  }
  if (job.valid_through) {
    const expected = validThroughTimestamp(job.valid_through);
    if (schema.validThrough !== expected) {
      issues.push("validThrough is required when the visit has an expiration date");
    }
  } else if ("validThrough" in schema) {
    issues.push("validThrough must be omitted when the visit has no expiration date");
  }
  if (schema.identifier.value !== job.referencenumber) {
    issues.push("identifier.value must be the referencenumber");
  }
  if (schema.directApply !== false) issues.push("directApply must be false");
  if (schema.employmentType !== EMPLOYMENT_TYPE[job.jobtype]) {
    issues.push("employmentType must match the job type");
  }
  if ("baseSalary" in schema) {
    const salary = schema.baseSalary as { value?: { unitText?: string } };
    const unit = salary.value?.unitText ?? "";
    if (!GOOGLE_SALARY_UNITS.has(unit)) {
      issues.push(`baseSalary.unitText ${unit} is not a Google time unit`);
    }
  }
  return issues;
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
