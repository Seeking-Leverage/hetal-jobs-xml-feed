import { JobsDataError } from "./config";
import {
  JOB_PAY,
  JOB_REQUISITION_ID,
  JOB_TITLE,
  JOB_TITLE_ID,
  JOB_TYPE,
  OPEN_DAYS,
  descriptionHtml,
} from "./description";
import type { Job } from "./types";

export const DEFAULT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1jRI2rzi_JONSOLvSaBebV54QUV8wJe57tfV74zPcDwM/export?format=csv";

/** This version imports the week dated 11/2/26. */
export const DEFAULT_IMPORT_WEEK = "2026-11-02";

export type SheetRow = {
  city: string;
  state: string;
  postalcode: string;
  metro: string;
  date_posted: string;
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}

export function parseSheetDate(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) {
    throw new JobsDataError(`Date Added must look like 11/2/26. Received ${JSON.stringify(value)}.`);
  }
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  const month = String(Number(match[1])).padStart(2, "0");
  const day = String(Number(match[2])).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayInNewYork(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

export function splitCity(value: string): { city: string; state: string } {
  const match = value.trim().match(/^(.+),\s*([A-Za-z]{2})$/);
  if (!match) {
    throw new JobsDataError(
      `City must look like "Nashua, NH". Received ${JSON.stringify(value)}.`,
    );
  }
  return { city: match[1].trim(), state: match[2].toUpperCase() };
}

export function padZip(value: string): string {
  const digits = value.trim();
  if (!/^\d{1,5}$/.test(digits)) {
    throw new JobsDataError(
      `Zip must be 1 to 5 digits. Received ${JSON.stringify(value)}.`,
    );
  }
  return digits.padStart(5, "0");
}

export function rowsFromCsv(text: string): SheetRow[] {
  const table = parseCsv(text.replace(/^\uFEFF/, ""));
  if (table.length < 2) {
    throw new JobsDataError("The job CSV needs a header and at least one row.");
  }
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const column = (name: string) => {
    const index = header.indexOf(name);
    if (index === -1) {
      throw new JobsDataError(`The job CSV is missing a ${name} column.`);
    }
    return index;
  };
  const cityIndex = column("city");
  const zipIndex = column("zip");
  const metroIndex = column("metro");
  const dateIndex = column("date added");

  return table.slice(1).map((cells) => {
    const place = splitCity(cells[cityIndex] ?? "");
    return {
      city: place.city,
      state: place.state,
      postalcode: padZip(cells[zipIndex] ?? ""),
      metro: (cells[metroIndex] ?? "").trim(),
      date_posted: parseSheetDate(cells[dateIndex] ?? ""),
    };
  });
}

function sequence(number: number): string {
  return String(number).padStart(2, "0");
}

function referencePrefix(row: SheetRow): string {
  return `HTL-${row.postalcode}-${row.date_posted.replaceAll("-", "")}-${JOB_TITLE_ID}-`;
}

export function jobsFromSheetRows(
  rows: SheetRow[],
  options: { week: string; today: string; existing?: Job[] },
): Job[] {
  const weekRows = rows.filter((row) => row.date_posted === options.week);
  if (weekRows.length === 0) {
    throw new JobsDataError(`No CSV rows are dated ${options.week}.`);
  }

  const existing = (options.existing ?? []).filter((job) => job.metro);
  const generated: Job[] = [];
  const validThrough = addDays(options.week, OPEN_DAYS - 1);
  const inWindow = options.today >= options.week && options.today <= validThrough;

  for (const row of weekRows) {
    const prefix = referencePrefix(row);
    let number = 1;
    let referencenumber = "";
    while (number <= 99) {
      const candidate = `${prefix}${sequence(number)}`;
      const prior = existing.find((job) => job.referencenumber === candidate);
      const already = generated.some((job) => job.referencenumber === candidate);
      const sameVisit =
        prior &&
        prior.postalcode === row.postalcode &&
        prior.date_posted === row.date_posted &&
        prior.title_id === JOB_TITLE_ID &&
        !already;
      if (!prior && !already) {
        referencenumber = candidate;
        break;
      }
      if (sameVisit) {
        referencenumber = candidate;
        break;
      }
      number += 1;
    }
    if (!referencenumber) {
      throw new JobsDataError(`No unused reference number remains for ${prefix}.`);
    }

    const prior = existing.find((job) => job.referencenumber === referencenumber);
    const status = !inWindow || prior?.status === "closed" ? "closed" : "open";
    generated.push({
      referencenumber,
      requisitionid: JOB_REQUISITION_ID,
      title: JOB_TITLE,
      title_id: JOB_TITLE_ID,
      city: row.city,
      state: row.state,
      country: "US",
      postalcode: row.postalcode,
      metro: row.metro,
      pay: JOB_PAY,
      jobtype: JOB_TYPE,
      description_html: descriptionHtml(row.city, row.state, row.postalcode),
      status,
      date_posted: row.date_posted,
      valid_through: validThrough,
    });
  }

  const generatedRefs = new Set(generated.map((job) => job.referencenumber));
  const retained = existing
    .filter((job) => !generatedRefs.has(job.referencenumber))
    .map((job) => ({ ...job, status: "closed" as const }));

  return [...generated, ...retained].sort((a, b) =>
    `${a.state}${a.city}${a.postalcode}${a.referencenumber}`.localeCompare(
      `${b.state}${b.city}${b.postalcode}${b.referencenumber}`,
    ),
  );
}
