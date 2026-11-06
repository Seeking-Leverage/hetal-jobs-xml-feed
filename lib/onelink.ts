import { boardPid } from "./channels";
import { getOnelinkBaseUrl } from "./config";
import type { Job } from "./types";

export type OnelinkAttribution = {
  channel?: string | string[] | null;
  source?: string | string[] | null;
};

const REPLACED_KEYS = new Set(["af_adset", "af_sub1", "af_sub2"]);

function decodeKey(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function queryPairs(search: string): Array<{ key: string; raw: string }> {
  if (!search) return [];
  return search
    .split("&")
    .filter(Boolean)
    .map((raw) => {
      const eq = raw.indexOf("=");
      const key = eq === -1 ? raw : raw.slice(0, eq);
      return { key: decodeKey(key), raw };
    });
}

export function buildOnelink(
  job: Pick<Job, "title_id" | "postalcode" | "referencenumber">,
  attribution: OnelinkAttribution = {},
): string {
  const base = getOnelinkBaseUrl().replace(/[?&]$/, "");
  const splitAt = base.indexOf("?");
  const path = splitAt === -1 ? base : base.slice(0, splitAt);
  const search = splitAt === -1 ? "" : base.slice(splitAt + 1);
  const pid = boardPid(attribution.channel, attribution.source);
  let seenPid = false;
  let seenC = false;
  const kept: string[] = [];

  for (const pair of queryPairs(search)) {
    if (pair.key === "pid") {
      if (seenPid) continue;
      seenPid = true;
      kept.push(pid ? `pid=${encodeURIComponent(pid)}` : pair.raw);
      continue;
    }
    if (pair.key === "c") {
      if (seenC) continue;
      seenC = true;
      kept.push(pair.raw);
      continue;
    }
    if (REPLACED_KEYS.has(pair.key)) continue;
    kept.push(pair.raw);
  }

  if (pid && !seenPid) kept.push(`pid=${encodeURIComponent(pid)}`);
  kept.push(
    `af_adset=${encodeURIComponent(job.title_id)}`,
    `af_sub1=${encodeURIComponent(job.postalcode)}`,
    `af_sub2=${encodeURIComponent(job.referencenumber)}`,
  );
  return `${path}?${kept.join("&")}`;
}
