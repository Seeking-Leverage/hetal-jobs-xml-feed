import { CHANNEL_PID, type Channel } from "./channels";

export function jobPath(referencenumber: string): string {
  return `/jobs/${encodeURIComponent(referencenumber)}`;
}

/** Permanent public URL for one visit. No channel or source query. */
export function jobCanonicalUrl(siteUrl: string, referencenumber: string): string {
  return new URL(jobPath(referencenumber), siteUrl).toString();
}

export function sitemapJobUrls(
  jobs: Array<{ status: string; referencenumber: string }>,
  origin: string,
): string[] {
  return jobs
    .filter((job) => job.status === "open")
    .map((job) => jobCanonicalUrl(origin, job.referencenumber));
}

export function jobFeedUrl(
  siteUrl: string,
  referencenumber: string,
  channel: Channel = "indeed",
): string {
  const url = new URL(jobPath(referencenumber), siteUrl);
  url.searchParams.set("channel", channel);
  url.searchParams.set("source", CHANNEL_PID[channel]);
  return url.toString();
}
