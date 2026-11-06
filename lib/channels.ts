export const CHANNELS = ["indeed", "adzuna", "ziprecruiter"] as const;

export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_PID: Record<Channel, string> = {
  indeed: "Indeed",
  adzuna: "Adzuna",
  ziprecruiter: "ZipRecruiter",
};

const SAFE_PID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function firstQueryValue(value: string | string[] | null | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Board name for the OneLink pid. Source wins when it is a safe name.
 * A known channel uses its board name. Any other safe slug is used as given.
 * Missing or unsafe values leave the base pid alone.
 */
export function boardPid(
  channel?: string | string[] | null,
  source?: string | string[] | null,
): string | undefined {
  const sourceName = firstQueryValue(source);
  if (sourceName && SAFE_PID.test(sourceName)) return sourceName;
  const channelName = firstQueryValue(channel);
  if (!channelName || !SAFE_PID.test(channelName)) return undefined;
  const known = CHANNEL_PID[channelName.toLowerCase() as Channel];
  return known ?? channelName;
}
