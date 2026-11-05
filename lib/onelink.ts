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
  // The base already includes af_web_dp, af_xp, and pid=Indeed.
  // Append only the visit params. Do not add another pid or c=indeed_launch.
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}${added}`;
}
