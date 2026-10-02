/**
 * lib/dates.ts
 *
 * Explicit UTC date utilities for daily practice quizzes.
 * All daily assets are partitioned by UTC date (YYYY-MM-DD).
 */

export function getTodayUtcString(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getYesterdayUtcString(referenceDateStr?: string): string {
  const date = referenceDateStr
    ? new Date(`${referenceDateStr}T00:00:00Z`)
    : new Date();

  date.setUTCDate(date.getUTCDate() - 1);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateStr: string): string {
  try {
    const date = new Date(`${dateStr}T12:00:00Z`);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return dateStr;
  }
}
