import { JobsDataError } from "./config";
export const DEFAULT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1jRI2rzi_JONSOLvSaBebV54QUV8wJe57tfV74zPcDwM/export?format=csv&gid=0";

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

function rowFromCells(
  cells: string[],
  cityIndex: number,
  zipIndex: number,
  metroIndex: number,
  dateIndex: number,
): SheetRow {
  const place = splitCity(cells[cityIndex] ?? "");
  return {
    city: place.city,
    state: place.state,
    postalcode: padZip(cells[zipIndex] ?? ""),
    metro: (cells[metroIndex] ?? "").trim(),
    date_posted: parseSheetDate(cells[dateIndex] ?? ""),
  };
}

export function parseSheet(text: string): { rows: SheetRow[]; skipped: string[] } {
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
  const rows: SheetRow[] = [];
  const skipped: string[] = [];
  table.slice(1).forEach((cells, index) => {
    try {
      rows.push(rowFromCells(cells, cityIndex, zipIndex, metroIndex, dateIndex));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid row.";
      skipped.push(`row ${index + 2}: ${message}`);
    }
  });
  return { rows, skipped };
}

export function rowsFromCsv(text: string): SheetRow[] {
  const parsed = parseSheet(text);
  if (parsed.skipped.length > 0) {
    throw new JobsDataError(parsed.skipped[0] ?? "The job CSV has an invalid row.");
  }
  return parsed.rows;
}

/** One row per ZIP. The latest Date Added wins. */
export function uniqueZips(rows: SheetRow[]): SheetRow[] {
  const byZip = new Map<string, SheetRow>();
  for (const row of rows) {
    const current = byZip.get(row.postalcode);
    if (!current || row.date_posted >= current.date_posted) byZip.set(row.postalcode, row);
  }
  return [...byZip.values()];
}
