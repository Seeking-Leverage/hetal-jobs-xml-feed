import type { Job } from "./types";

export function closedReferencenumbers(jobs: Job[]): string[] {
  return jobs
    .filter((job) => job.status === "closed")
    .map((job) => job.referencenumber)
    .sort((a, b) => a.localeCompare(b, "en"));
}

export function decodeReferencenumber(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Closed job rewrite path, or null when this request should pass through. */
export function closedJobRewrite(
  pathname: string,
  search: string,
  closed: ReadonlySet<string>,
): string | null {
  const match = pathname.match(/^\/(HTL-[^/]+)$/);
  if (!match) return null;
  const ref = decodeReferencenumber(match[1] ?? "");
  if (!closed.has(ref)) return null;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.set("__closed", "1");
  return `/closed/${encodeURIComponent(ref)}?${params.toString()}`;
}
