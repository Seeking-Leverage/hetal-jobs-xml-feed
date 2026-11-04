import { getOnelinkBaseUrl } from "./config";
import type { Job } from "./types";

export function buildOnelink(
  job: Pick<Job, "title_id" | "postalcode" | "referencenumber">,
): string {
  const url = new URL(getOnelinkBaseUrl());
  url.searchParams.set("pid", "indeed");
  url.searchParams.set("c", job.title_id);
  url.searchParams.set("af_sub1", job.postalcode);
  url.searchParams.set("af_sub2", job.referencenumber);
  return url.toString();
}
