export function jobPath(referencenumber: string): string {
  return `/jobs/${encodeURIComponent(referencenumber)}`;
}

export function jobFeedUrl(siteUrl: string, referencenumber: string): string {
  const url = new URL(jobPath(referencenumber), siteUrl);
  url.searchParams.set("source", "Indeed");
  return url.toString();
}
