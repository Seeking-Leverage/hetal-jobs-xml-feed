import { getCompanyName } from "./config";
import { payToBaseSalary } from "./format";
import type { Job } from "./types";
import { jobPath } from "./urls";

const EMPLOYMENT_TYPE = {
  "part-time": "PART_TIME",
  "full-time": "FULL_TIME",
  contract: "CONTRACTOR",
} as const;

export function buildJobPosting(job: Job, siteUrl: string) {
  const company = getCompanyName();
  const baseSalary = payToBaseSalary(job.pay);

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description_html,
    datePosted: job.date_posted,
    employmentType: EMPLOYMENT_TYPE[job.jobtype],
    directApply: false,
    identifier: {
      "@type": "PropertyValue",
      name: company,
      value: job.referencenumber,
    },
    hiringOrganization: {
      "@type": "Organization",
      name: company,
      url: siteUrl,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city,
        addressRegion: job.state,
        postalCode: job.postalcode,
        addressCountry: job.country,
      },
    },
    url: new URL(jobPath(job.referencenumber), siteUrl).toString(),
    ...(baseSalary ? { baseSalary } : {}),
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
