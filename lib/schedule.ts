import { JobsDataError } from "./config";

export type JobTitle = {
  title_id: string;
  title: string;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function weekdayIndex(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function weekdayName(isoDate: string): string {
  return WEEKDAYS[weekdayIndex(isoDate)];
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

/**
 * Tuesday, Wednesday, and Thursday each use one title.
 * Friday through Monday have no open jobs.
 * titles[0] is Tuesday, titles[1] is Wednesday, titles[2] is Thursday.
 */
export function titleForDate(today: string, titles: JobTitle[]): JobTitle | null {
  if (titles.length !== 3) {
    throw new JobsDataError("The weekday rotation needs exactly three titles.");
  }
  const day = weekdayIndex(today);
  if (day < 2 || day > 4) return null;
  return titles[day - 2];
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
