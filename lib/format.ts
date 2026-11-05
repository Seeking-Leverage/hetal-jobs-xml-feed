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

const PAY_UNIT: Record<string, "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR" | "PIECE"> = {
  audit: "PIECE",
  hour: "HOUR",
  day: "DAY",
  week: "WEEK",
  month: "MONTH",
  year: "YEAR",
};

export function payToBaseSalary(pay: string) {
  const match = pay.match(
    /^\$(\d+(?:\.\d{2})?)(?: - \$(\d+(?:\.\d{2})?))? per (audit|hour|day|week|month|year)$/,
  );
  if (!match) return undefined;

  const minimum = Number(match[1]);
  const maximum = match[2] ? Number(match[2]) : undefined;
  const unitText = PAY_UNIT[match[3]];

  return {
    "@type": "MonetaryAmount" as const,
    currency: "USD",
    value: {
      "@type": "QuantitativeValue" as const,
      unitText,
      ...(maximum === undefined
        ? { value: minimum }
        : { minValue: minimum, maxValue: maximum }),
    },
  };
}
