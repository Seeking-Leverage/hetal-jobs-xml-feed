import fs from "node:fs";
import path from "node:path";

import rawJobs from "../data/jobs.json";
import { JobsDataError } from "./config";
import { JOB_STATUSES, JOB_TYPES, type Job, type JobStatus, type JobType } from "./types";

const ENTITY = /&(?:#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]+);/;
const PAY_PATTERN =
  /^\$\d+(?:\.\d{2})?(?: - \$\d+(?:\.\d{2})?)? per (?:audit|hour|day|week|month|year)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/;
const TITLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATE_PATTERN = /^[A-Z]{2}$/;

function jobsFilePath(): string {
  return path.join(process.cwd(), "data", "jobs.json");
}

function readJobsSource(): unknown {
  const file = jobsFilePath();
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new JobsDataError(`data/jobs.json is not valid JSON. ${error.message}`);
      }
      throw error;
    }
  }
  return rawJobs;
}

function asRecord(value: unknown, index: number): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new JobsDataError(`jobs[${index}] must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(
  record: Record<string, unknown>,
  field: string,
  index: number,
): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new JobsDataError(`jobs[${index}].${field} must be a non-empty string.`);
  }
  return value.trim();
}

function assertNoEntities(field: string, value: string, index: number) {
  if (ENTITY.test(value)) {
    throw new JobsDataError(
      `jobs[${index}].${field} contains an HTML entity. Use the character itself so Indeed can read it.`,
    );
  }
}

function normalizePostalCode(value: unknown, index: number): string {
  const raw =
    typeof value === "number" && Number.isInteger(value)
      ? String(value)
      : typeof value === "string"
        ? value.trim()
        : "";
  if (!/^\d{1,5}$/.test(raw)) {
    throw new JobsDataError(
      `jobs[${index}].postalcode must be 1 to 5 digits, stored as text so leading zeros survive. Example: "03060".`,
    );
  }
  return raw.padStart(5, "0");
}

function normalizeJob(value: unknown, index: number): Job {
  const record = asRecord(value, index);
  const referencenumber = requiredString(record, "referencenumber", index);
  if (!REF_PATTERN.test(referencenumber)) {
    throw new JobsDataError(
      `jobs[${index}].referencenumber must be 2 to 64 letters, numbers, hyphens, or underscores.`,
    );
  }

  const title = requiredString(record, "title", index);
  const title_id = requiredString(record, "title_id", index);
  if (!TITLE_ID_PATTERN.test(title_id)) {
    throw new JobsDataError(
      `jobs[${index}].title_id must be a slug such as "store-auditor". It is sent as the OneLink campaign.`,
    );
  }

  const city = requiredString(record, "city", index);
  const state = requiredString(record, "state", index);
  if (!STATE_PATTERN.test(state)) {
    throw new JobsDataError(
      `jobs[${index}].state must be a two-letter postal abbreviation such as "NH".`,
    );
  }

  const country = requiredString(record, "country", index);
  if (country !== "US") {
    throw new JobsDataError(`jobs[${index}].country must be "US".`);
  }

  const pay = requiredString(record, "pay", index);
  if (!PAY_PATTERN.test(pay)) {
    throw new JobsDataError(
      `jobs[${index}].pay must look like "$6 - $17 per audit" so Indeed can read the salary.`,
    );
  }

  const jobtype = requiredString(record, "jobtype", index);
  if (!JOB_TYPES.includes(jobtype as JobType)) {
    throw new JobsDataError(
      `jobs[${index}].jobtype must be one of: ${JOB_TYPES.join(", ")}.`,
    );
  }

  const status = requiredString(record, "status", index);
  if (!JOB_STATUSES.includes(status as JobStatus)) {
    throw new JobsDataError(`jobs[${index}].status must be "open" or "closed".`);
  }

  const date_posted = requiredString(record, "date_posted", index);
  if (!DATE_PATTERN.test(date_posted) || Number.isNaN(Date.parse(`${date_posted}T00:00:00Z`))) {
    throw new JobsDataError(
      `jobs[${index}].date_posted must be an ISO-8601 date, YYYY-MM-DD.`,
    );
  }

  const description_html = requiredString(record, "description_html", index);
  if (/<\s*(script|iframe|object|embed|style)\b/i.test(description_html)) {
    throw new JobsDataError(
      `jobs[${index}].description_html cannot include script, style, iframe, object, or embed tags.`,
    );
  }
  if (description_html.includes("]]>")) {
    throw new JobsDataError(
      `jobs[${index}].description_html cannot include the characters "]]>".`,
    );
  }

  const requisitionid = requiredString(record, "requisitionid", index);
  const fields: Record<string, string> = {
    referencenumber,
    requisitionid,
    title,
    title_id,
    city,
    state,
    country,
    pay,
    description_html,
    date_posted,
  };
  for (const [field, fieldValue] of Object.entries(fields)) {
    assertNoEntities(field, fieldValue, index);
  }

  return {
    referencenumber,
    requisitionid,
    title,
    title_id,
    city,
    state,
    country,
    postalcode: normalizePostalCode(record.postalcode, index),
    pay,
    jobtype: jobtype as JobType,
    description_html,
    status: status as JobStatus,
    date_posted,
  };
}

export function loadJobs(): Job[] {
  const source = readJobsSource();
  if (!Array.isArray(source)) {
    throw new JobsDataError("data/jobs.json must be an array of jobs.");
  }

  const jobs = source.map((entry, index) => normalizeJob(entry, index));
  const seen = new Set<string>();
  for (const job of jobs) {
    if (seen.has(job.referencenumber)) {
      throw new JobsDataError(
        `referencenumber ${job.referencenumber} is used more than once. Indeed keeps only the first.`,
      );
    }
    seen.add(job.referencenumber);
  }
  return jobs;
}

export function decodeReferencenumber(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function findJob(referencenumber: string): Job | undefined {
  const ref = decodeReferencenumber(referencenumber);
  return loadJobs().find((job) => job.referencenumber === ref);
}

export function openJobs(jobs: Job[] = loadJobs()): Job[] {
  return jobs.filter((job) => job.status === "open");
}
