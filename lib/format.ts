import type { JobType } from "./types";

const JOB_TYPE_LABELS: Record<JobType, string> = {
  "part-time": "Part-time",
  "full-time": "Full-time",
  contract: "Independent contractor",
};

export function formatJobType(jobtype: JobType): string {
  return JOB_TYPE_LABELS[jobtype];
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function formatLongDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return isoDate;
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

