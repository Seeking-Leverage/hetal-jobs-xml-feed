import { getOnelinkBaseUrl } from "./config";
import type { Job } from "./types";

export function buildOnelink(
  job: Pick<Job, "title_id" | "postalcode" | "referencenumber">,
): string {
  const base = getOnelinkBaseUrl().replace(/[?&]$/, "");
  const added = [
    ["c", job.title_id],
    ["af_sub1", job.postalcode],
    ["af_sub2", job.referencenumber],
  ]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  // The Hetal base URL already includes ?af_xp=custom&pid=job-board-xml.
  // Keep that pid and append the visit params with "&".
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}${added}`;
}
