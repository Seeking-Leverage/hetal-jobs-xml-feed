import { CHANNEL_PID, type Channel } from "./channels";

export function jobPath(referencenumber: string): string {
  return `/jobs/${encodeURIComponent(referencenumber)}`;
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
