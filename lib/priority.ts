export type Priority = 1 | 2 | 3 | 4 | 5;

/** How many newest Date Added weeks stay open. Older weeks close on sync. */
export const OPEN_WEEK_LIMIT = 5;

function distinctWeeksNewestFirst(dates: string[]): string[] {
  return [...new Set(dates.filter((date) => date !== ""))].sort((a, b) => b.localeCompare(a));
}

/** The newest `limit` distinct Date Added dates. */
export function newestDateAddedWeeks(dates: string[], limit = OPEN_WEEK_LIMIT): Set<string> {
  return new Set(distinctWeeksNewestFirst(dates).slice(0, limit));
}

/**
 * Rank distinct Date Added dates. The newest date is 1.
 * Each older date steps up by one, and every date past the fourth stays at 5.
 */
export function priorityByDateAdded(dates: string[]): Map<string, Priority> {
  const weeks = distinctWeeksNewestFirst(dates);
  const ranks = new Map<string, Priority>();
  weeks.forEach((week, index) => {
    ranks.set(week, Math.min(index + 1, 5) as Priority);
  });
  return ranks;
}
