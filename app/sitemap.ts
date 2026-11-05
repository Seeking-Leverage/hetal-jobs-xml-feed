import type { MetadataRoute } from "next";

import { siteUrlFrom } from "@/lib/config";
import { openJobs } from "@/lib/jobs";
import { jobCanonicalUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrlFrom({ get: () => null });
  const jobs = openJobs().map((job) => ({
    url: jobCanonicalUrl(origin, job.referencenumber),
    lastModified: job.date_posted,
  }));

  return [
    {
      url: `${origin}/`,
      lastModified: jobs[0]?.lastModified,
    },
    ...jobs,
  ];
}
