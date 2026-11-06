import type { MetadataRoute } from "next";

import { openJobs } from "@/lib/jobs";
import { jobCanonicalUrl, jobsHomeUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const jobs = openJobs().map((job) => ({
    url: jobCanonicalUrl(jobsHomeUrl(), job.referencenumber),
    lastModified: job.date_posted,
  }));

  return [
    {
      url: jobsHomeUrl(),
      lastModified: jobs[0]?.lastModified,
    },
    ...jobs,
  ];
}
