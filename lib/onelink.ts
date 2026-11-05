import { CHANNEL_PID, type Channel } from "./channels";
import { getOnelinkBaseUrl } from "./config";
import type { Job } from "./types";

export function buildOnelink(
  job: Pick<Job, "title_id" | "postalcode" | "referencenumber">,
  channel: Channel = "indeed",
): string {
  const base = getOnelinkBaseUrl().replace(/[?&]$/, "");
  const url = new URL(base);
  // Replace the base pid for this channel. Do not add a second pid.
  url.searchParams.set("pid", CHANNEL_PID[channel]);
  url.searchParams.delete("c");
  url.searchParams.delete("af_sub1");
  url.searchParams.delete("af_sub2");
  const withPid = url.toString().replace(/[?&]$/, "");
  const added = [
    ["c", job.title_id],
    ["af_sub1", job.postalcode],
    ["af_sub2", job.referencenumber],
  ]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const joiner = withPid.includes("?") ? "&" : "?";
  return `${withPid}${joiner}${added}`;
}
