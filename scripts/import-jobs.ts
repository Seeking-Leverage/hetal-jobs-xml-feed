import fs from "node:fs";
import path from "node:path";

import { loadJobs } from "../lib/jobs";
import {
  DEFAULT_CSV_URL,
  DEFAULT_IMPORT_WEEK,
  jobsFromSheetRows,
  parseSheetDate,
  rowsFromCsv,
  todayInNewYork,
} from "../lib/sheet";

function loadEnvFile(filename: string) {
  const file = path.join(process.cwd(), filename);
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function readCsv(): Promise<string> {
  const argument = process.argv.slice(2).find((value) => !value.startsWith("-"));
  const file = argument || process.env.JOBS_CSV_PATH?.trim();
  if (file) {
    return fs.readFileSync(path.resolve(file), "utf8");
  }
  const url = process.env.JOBS_CSV_URL?.trim() || DEFAULT_CSV_URL;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(`Could not download the job CSV (${response.status}) from ${url}`);
  }
  return response.text();
}

async function main() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");
  const week = process.env.IMPORT_WEEK?.trim()
    ? parseSheetDate(process.env.IMPORT_WEEK.trim())
    : DEFAULT_IMPORT_WEEK;
  const csv = await readCsv();
  const rows = rowsFromCsv(csv);
  const existingPath = path.join(process.cwd(), "data", "jobs.json");
  const existing = fs.existsSync(existingPath) ? loadJobs() : [];
  const jobs = jobsFromSheetRows(rows, {
    week,
    today: todayInNewYork(),
    existing,
  });
  fs.writeFileSync(existingPath, `${JSON.stringify(jobs, null, 2)}\n`);
  const open = jobs.filter((job) => job.status === "open").length;
  console.log(
    `Wrote ${jobs.length} jobs (${open} open, ${jobs.length - open} closed) for ${week} to data/jobs.json`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
