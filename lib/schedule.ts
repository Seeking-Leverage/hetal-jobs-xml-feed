import { JobsDataError } from "./config";

export type JobTitle = {
  title_id: string;
  title: string;
};

export type PoolTitle = JobTitle & {
  active: boolean;
  weight: number;
};

export type TitlePool = {
  start_date: string;
  titles: PoolTitle[];
};

export type TitleHistoryEntry = {
  date: string;
  title: string;
  title_id: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new JobsDataError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function parseTitlePool(source: unknown): TitlePool {
  const record = asRecord(source, "config/titles.json");
  const start_date = record.start_date;
  if (typeof start_date !== "string" || !DATE_PATTERN.test(start_date)) {
    throw new JobsDataError("config/titles.json start_date must be YYYY-MM-DD.");
  }
  if (!Array.isArray(record.titles) || record.titles.length === 0) {
    throw new JobsDataError("config/titles.json must list at least one title.");
  }

  const seen = new Set<string>();
  const titles = record.titles.map((entry, index) => {
    const titleRecord = asRecord(entry, `titles[${index}]`);
    const title_id = titleRecord.title_id;
    const title = titleRecord.title;
    if (typeof title_id !== "string" || !SLUG_PATTERN.test(title_id)) {
      throw new JobsDataError(`titles[${index}].title_id must be a lowercase slug.`);
    }
    if (seen.has(title_id)) {
      throw new JobsDataError(`titles[${index}].title_id ${title_id} is used more than once.`);
    }
    seen.add(title_id);
    if (typeof title !== "string" || title.trim() === "") {
      throw new JobsDataError(`titles[${index}].title must be text.`);
    }
    const active = titleRecord.active === undefined ? true : titleRecord.active;
    if (typeof active !== "boolean") {
      throw new JobsDataError(`titles[${index}].active must be true or false.`);
    }
    const weight = titleRecord.weight === undefined ? 1 : titleRecord.weight;
    if (typeof weight !== "number" || !Number.isInteger(weight) || weight < 1) {
      throw new JobsDataError(`titles[${index}].weight must be a positive integer.`);
    }
    return { title_id, title, active, weight };
  });

  return { start_date, titles };
}

/** Active titles expanded by weight. An inactive title is left out. */
export function activeCycle(pool: TitlePool): JobTitle[] {
  const cycle: JobTitle[] = [];
  for (const entry of pool.titles) {
    if (!entry.active) continue;
    for (let count = 0; count < entry.weight; count += 1) {
      cycle.push({ title_id: entry.title_id, title: entry.title });
    }
  }
  if (cycle.length === 0) {
    throw new JobsDataError("config/titles.json needs at least one active title.");
  }
  return cycle;
}

function utcDay(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysFromStart(start: string, today: string): number {
  return Math.round((utcDay(today) - utcDay(start)) / 86_400_000);
}

/**
 * The title for one Eastern calendar date.
 * Day zero is start_date. The cycle is the active titles in file order, each repeated by its weight.
 * The same date always returns the same title.
 */
export function titleForDate(today: string, pool: TitlePool): JobTitle {
  const cycle = activeCycle(pool);
  const index = daysFromStart(pool.start_date, today) % cycle.length;
  return cycle[(index + cycle.length) % cycle.length];
}

export type OpenPlan = {
  /** Date stored on the job and in its reference number. */
  date: string;
  validThrough: string;
  title: JobTitle;
  titleAt: (index: number) => JobTitle;
};

/** Every open ZIP uses the same title for this date. The title lasts through that date. */
export function planForDate(today: string, pool: TitlePool): OpenPlan {
  const title = titleForDate(today, pool);
  return {
    date: today,
    validThrough: today,
    title,
    titleAt: () => title,
  };
}

/** One row per date. A later sync on the same date replaces that row instead of adding another. */
export function recordTitleDay(
  history: TitleHistoryEntry[],
  today: string,
  title: JobTitle,
): TitleHistoryEntry[] {
  const row: TitleHistoryEntry = { date: today, title: title.title, title_id: title.title_id };
  const next = history.filter((entry) => entry.date !== today);
  next.push(row);
  next.sort((a, b) => a.date.localeCompare(b.date));
  return next;
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
