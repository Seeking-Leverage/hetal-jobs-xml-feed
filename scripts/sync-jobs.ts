import fs from "node:fs";
import path from "node:path";

import { loadLocalEnv } from "../lib/env-file";
import { loadJobs } from "../lib/jobs";
import { parseTitles } from "../lib/schedule";
import { DEFAULT_CSV_URL, parseSheet, todayInNewYork } from "../lib/sheet";
import { syncSheetJobs } from "../lib/sync";

async function readCsv(): Promise<string> {
  const argument = process.argv.slice(2).find((value) => !value.startsWith("-"));
  const file = argument || process.env.JOBS_CSV_PATH?.trim();
  if (file) return fs.readFileSync(path.resolve(file), "utf8");
  const url = process.env.JOBS_CSV_URL?.trim() || DEFAULT_CSV_URL;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(`Could not download the job CSV (${response.status}) from ${url}`);
  }
  return response.text();
}

async function main() {
  loadLocalEnv();
  const csv = await readCsv();
  const parsed = parseSheet(csv);
  if (parsed.rows.length === 0) {
    throw new Error("The job CSV has no valid ZIP rows.");
  }
  for (const message of parsed.skipped) console.warn(`skipped ${message}`);

  const root = process.cwd();
  const jobsPath = path.join(root, "data", "jobs.json");
  const titles = parseTitles(JSON.parse(fs.readFileSync(path.join(root, "data", "titles.json"), "utf8")));
  const existing = fs.existsSync(jobsPath) ? loadJobs() : [];
  const today = todayInNewYork();
  const jobs = syncSheetJobs(parsed.rows, existing, today, titles);
  fs.writeFileSync(jobsPath, `${JSON.stringify(jobs, null, 2)}\n`);
  const open = jobs.filter((job) => job.status === "open");
  const counts = new Map<string, number>();
  for (const job of open) counts.set(job.title, (counts.get(job.title) ?? 0) + 1);
  const summary = [...counts.entries()].map(([title, count]) => `${count} ${title}`).join(", ") || "none";
  console.log(
    `Wrote ${jobs.length} jobs (${open.length} open: ${summary}; ${jobs.length - open.length} closed) for ${today}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
