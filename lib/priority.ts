export type Priority = 1 | 2 | 3 | 4 | 5;

/**
 * Rank distinct Date Added dates. The newest date is 1.
 * Each older date steps up by one, and every date past the fourth stays at 5.
 */
export function priorityByDateAdded(dates: string[]): Map<string, Priority> {
  const weeks = [...new Set(dates.filter((date) => date !== ""))].sort((a, b) => b.localeCompare(a));
  const ranks = new Map<string, Priority>();
  weeks.forEach((week, index) => {
    ranks.set(week, Math.min(index + 1, 5) as Priority);
  });
  return ranks;
}
