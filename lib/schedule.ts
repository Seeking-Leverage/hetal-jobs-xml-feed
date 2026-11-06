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

function shiftDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type OpenPlan = {
  /** Date stored on the job and in its reference number. */
  date: string;
  validThrough: string;
  /** Set when every ZIP uses the same title. Null when titles are mixed. */
  title: JobTitle | null;
  titleAt: (index: number) => JobTitle;
};

/**
 * Tuesday, Wednesday, and Thursday each use one title for every ZIP.
 * Friday through Monday use all three titles, split across every ZIP.
 * That mix is dated Friday and stays the same through Monday.
 * titles[0] is Tuesday, titles[1] is Wednesday, titles[2] is Thursday.
 */
export function planForDate(today: string, titles: JobTitle[]): OpenPlan {
  if (titles.length !== 3) {
    throw new JobsDataError("The weekday rotation needs exactly three titles.");
  }
  const day = weekdayIndex(today);
  if (day >= 2 && day <= 4) {
    const title = titles[day - 2];
    return {
      date: today,
      validThrough: today,
      title,
      titleAt: () => title,
    };
  }
  const daysSinceFriday = day === 5 ? 0 : day === 6 ? 1 : day === 0 ? 2 : 3;
  const friday = shiftDate(today, -daysSinceFriday);
  const offset = Number(friday.replaceAll("-", "")) % 3;
  return {
    date: friday,
    validThrough: shiftDate(friday, 3),
    title: null,
    titleAt: (index) => titles[(index + offset) % 3],
  };
}

/** The single title for a Tuesday, Wednesday, or Thursday. Other days return null. */
export function titleForDate(today: string, titles: JobTitle[]): JobTitle | null {
  return planForDate(today, titles).title;
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
