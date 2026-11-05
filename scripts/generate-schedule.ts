import fs from "node:fs";
import path from "node:path";

import { loadJobs } from "../lib/jobs";
import {
  applySchedule,
  generateSchedule,
  parseTitles,
  type TitleSchedule,
} from "../lib/schedule";
import { todayInNewYork } from "../lib/sheet";

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function main() {
  const root = process.cwd();
  const jobsPath = path.join(root, "data", "jobs.json");
  const titlesPath = path.join(root, "data", "titles.json");
  const schedulePath = path.join(root, "data", "title-schedule.json");
  const jobs = loadJobs();
  const titles = parseTitles(readJson(titlesPath));
  const previous = fs.existsSync(schedulePath)
    ? (readJson(schedulePath) as TitleSchedule)
    : undefined;
  const today = todayInNewYork();
  const schedule = generateSchedule(jobs, titles, today, previous);
  fs.writeFileSync(schedulePath, `${JSON.stringify(schedule, null, 2)}\n`);

  const nextJobs = applySchedule(jobs, schedule, today);
  const changed = JSON.stringify(nextJobs) !== JSON.stringify(jobs);
  if (changed) fs.writeFileSync(jobsPath, `${JSON.stringify(nextJobs, null, 2)}\n`);

  const approved = schedule.slots.filter((slot) => slot.approved).length;
  const open = nextJobs.filter((job) => job.status === "open").length;
  console.log(
    `Wrote ${schedule.slots.length} scheduled jobs for the week of ${schedule.week_of} (${approved} approved). ${open} jobs are open.${changed ? " Updated data/jobs.json." : " data/jobs.json was left unchanged."}`,
  );
}

main();
