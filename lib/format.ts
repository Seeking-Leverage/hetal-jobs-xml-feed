import type { JobType } from "./types";

const JOB_TYPE_LABELS: Record<JobType, string> = {
  "part-time": "Part-time",
  "full-time": "Full-time",
  contract: "Contract",
};

export function formatJobType(jobtype: JobType): string {
  return JOB_TYPE_LABELS[jobtype];
}

const PAY_UNIT: Record<string, "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR"> = {
  hour: "HOUR",
  day: "DAY",
  week: "WEEK",
  month: "MONTH",
  year: "YEAR",
};

export function payToBaseSalary(pay: string) {
  const match = pay.match(
    /^\$(\d+(?:\.\d{2})?)(?: - \$(\d+(?:\.\d{2})?))? per (hour|day|week|month|year)$/,
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
