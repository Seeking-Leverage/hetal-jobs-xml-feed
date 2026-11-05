export const CHANNELS = ["indeed", "adzuna", "ziprecruiter"] as const;

export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_PID: Record<Channel, string> = {
  indeed: "Indeed",
  adzuna: "Adzuna",
  ziprecruiter: "ZipRecruiter",
};

export function parseChannel(value: string | string[] | null | undefined): Channel {
  const raw = Array.isArray(value) ? value[0] : value;
  const key = raw?.trim().toLowerCase();
  if (key === "adzuna" || key === "ziprecruiter" || key === "indeed") return key;
  return "indeed";
}
