import { JobsDataError } from "./config";
import {
  JOB_PAY,
  JOB_TYPE,
  descriptionHtml,
} from "./description";
import { addDays } from "./sheet";
import type { Job } from "./types";

export type JobTitle = {
  title_id: string;
  title: string;
};

export type ScheduledJob = {
  postalcode: string;
  city: string;
  state: string;
  metro?: string;
  title_id: string;
  title: string;
  weekday: "Tuesday" | "Wednesday" | "Thursday";
  date: string;
  referencenumber: string;
  approved: boolean;
};

export type TitleSchedule = {
  week_of: string;
  slots: ScheduledJob[];
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const SLOT_WEEKDAYS = ["Tuesday", "Wednesday", "Thursday"] as const;

export function weekdayIndex(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function mondayOf(isoDate: string): string {
  const day = weekdayIndex(isoDate);
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(isoDate, delta);
}

export type LivePlan = {
  weekOf: string;
  titleIndex: number;
  liveDate: string;
  carry: boolean;
};

/** Which title is live on a calendar date. Friday through Sunday keep Thursday. */
export function livePlan(today: string): LivePlan {
  const weekOf = mondayOf(today);
  const day = weekdayIndex(today);
  if (day === 1 || day === 2) {
    return { weekOf, titleIndex: 0, liveDate: addDays(weekOf, 1), carry: false };
  }
  if (day === 3) {
    return { weekOf, titleIndex: 1, liveDate: addDays(weekOf, 2), carry: false };
  }
  return { weekOf, titleIndex: 2, liveDate: addDays(weekOf, 3), carry: day !== 4 };
}

export function parseTitles(source: unknown): JobTitle[] {
  if (!Array.isArray(source) || source.length !== 3) {
    throw new JobsDataError("data/titles.json must list exactly three titles.");
  }
  return source.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new JobsDataError(`titles[${index}] must be an object.`);
    }
    const record = entry as Record<string, unknown>;
    const title_id = record.title_id;
    const title = record.title;
    if (typeof title_id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(title_id)) {
      throw new JobsDataError(`titles[${index}].title_id must be a lowercase slug.`);
    }
    if (typeof title !== "string" || title.trim() === "") {
      throw new JobsDataError(`titles[${index}].title must be text.`);
    }
    return { title_id, title: title.trim() };
  });
}

function sequence(number: number): string {
  return String(number).padStart(2, "0");
}

export function nextReference(
  postalcode: string,
  date: string,
  titleId: string,
  used: Set<string>,
): string {
  const prefix = `HTL-${postalcode}-${date.replaceAll("-", "")}-${titleId}-`;
  for (let number = 1; number <= 99; number += 1) {
    const candidate = `${prefix}${sequence(number)}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new JobsDataError(`No unused reference number remains for ${prefix}.`);
}

type ZipPlace = {
  postalcode: string;
  city: string;
  state: string;
  metro?: string;
};

function activeZips(jobs: Job[]): ZipPlace[] {
  const byZip = new Map<string, Job>();
  for (const job of jobs) {
    if (!job.metro) continue;
    const current = byZip.get(job.postalcode);
    if (!current || job.date_posted >= current.date_posted) byZip.set(job.postalcode, job);
  }
  return [...byZip.values()]
    .map((job) => ({
      postalcode: job.postalcode,
      city: job.city,
      state: job.state,
      metro: job.metro,
    }))
    .sort((a, b) => a.postalcode.localeCompare(b.postalcode));
}

export function generateSchedule(
  jobs: Job[],
  titles: JobTitle[],
  today: string,
  previous?: TitleSchedule,
): TitleSchedule {
  if (titles.length !== 3) {
    throw new JobsDataError("The weekly test needs exactly three titles.");
  }
  const zips = activeZips(jobs);
  if (zips.length === 0) {
    throw new JobsDataError("No sheet ZIPs are available to schedule.");
  }
  const weekOf = mondayOf(today);
  const used = new Set(jobs.map((job) => job.referencenumber));
  for (const slot of previous?.slots ?? []) used.add(slot.referencenumber);

  const slots: ScheduledJob[] = [];
  for (const zip of zips) {
    for (let index = 0; index < 3; index += 1) {
      const date = addDays(weekOf, index + 1);
      const weekday = SLOT_WEEKDAYS[index];
      const catalog = titles[index];
      const prior = previous?.slots.find(
        (slot) => slot.postalcode === zip.postalcode && slot.date === date,
      );
      const title_id = prior?.title_id ?? catalog.title_id;
      const title = prior?.title ?? catalog.title;
      const prefix = `HTL-${zip.postalcode}-${date.replaceAll("-", "")}-${title_id}-`;
      const fromJob = jobs.find(
        (job) =>
          job.referencenumber.startsWith(prefix) &&
          job.postalcode === zip.postalcode &&
          job.date_posted === date &&
          job.title_id === title_id,
      )?.referencenumber;
      const fromPrior = prior?.referencenumber.startsWith(prefix) ? prior.referencenumber : "";
      const referencenumber = fromPrior || fromJob || nextReference(zip.postalcode, date, title_id, used);
      used.add(referencenumber);
      slots.push({
        postalcode: zip.postalcode,
        city: zip.city,
        state: zip.state,
        ...(zip.metro ? { metro: zip.metro } : {}),
        title_id,
        title,
        weekday,
        date,
        referencenumber,
        approved: prior?.approved === true,
      });
    }
  }

  return { week_of: weekOf, slots };
}

function jobFromSlot(slot: ScheduledJob, validThrough: string): Job {
  return {
    referencenumber: slot.referencenumber,
    requisitionid: `REQ-${slot.title_id.toUpperCase()}`,
    title: slot.title,
    title_id: slot.title_id,
    city: slot.city,
    state: slot.state,
    country: "US",
    postalcode: slot.postalcode,
    ...(slot.metro ? { metro: slot.metro } : {}),
    pay: JOB_PAY,
    jobtype: JOB_TYPE,
    description_html: descriptionHtml(slot.city, slot.state, slot.postalcode),
    status: "open",
    date_posted: slot.date,
    valid_through: validThrough,
  };
}

/**
 * Open the approved job for today and close the previous title for that ZIP.
 * Unapproved slots are never opened. Jobs that are not part of an approved
 * handoff stay as they are, so the current sheet week remains live until Andy
 * approves a title.
 */
export function applySchedule(jobs: Job[], schedule: TitleSchedule, today: string): Job[] {
  const plan = livePlan(today);
  const result = jobs.map((job) => ({ ...job }));
  const known = new Set(result.map((job) => job.referencenumber));
  const sunday = addDays(plan.weekOf, 6);
  const isMonday = weekdayIndex(today) === 1;

  const zips = new Set(schedule.slots.map((slot) => slot.postalcode));
  for (const postalcode of zips) {
    const live = schedule.slots.find(
      (slot) => slot.postalcode === postalcode && slot.date === plan.liveDate,
    );
    if (!live?.approved) {
      if (isMonday) {
        for (const job of result) {
          if (job.postalcode === postalcode && job.date_posted < plan.weekOf && job.status === "open") {
            job.status = "closed";
          }
        }
      }
      continue;
    }

    if (known.has(live.referencenumber)) {
      const existing = result.find((job) => job.referencenumber === live.referencenumber);
      if (!existing) continue;
      if (
        existing.postalcode !== live.postalcode ||
        existing.date_posted !== live.date ||
        existing.title_id !== live.title_id
      ) {
        throw new JobsDataError(
          `${live.referencenumber} already belongs to another visit and cannot be reused.`,
        );
      }
      existing.status = "open";
      existing.title = live.title;
      existing.title_id = live.title_id;
    } else {
      result.push(jobFromSlot(live, sunday));
      known.add(live.referencenumber);
    }

    for (const job of result) {
      if (
        job.postalcode === postalcode &&
        job.referencenumber !== live.referencenumber &&
        job.status === "open"
      ) {
        job.status = "closed";
      }
    }
  }

  return result.sort((a, b) =>
    `${a.state}${a.city}${a.postalcode}${a.referencenumber}`.localeCompare(
      `${b.state}${b.city}${b.postalcode}${b.referencenumber}`,
    ),
  );
}

export function weekdayName(isoDate: string): string {
  return WEEKDAYS[weekdayIndex(isoDate)];
}
