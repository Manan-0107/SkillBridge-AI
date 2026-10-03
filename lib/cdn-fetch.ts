import { RoadmapDocument } from "@/types/roadmap";
import { DailyPracticeDocument } from "@/types/practice";
import { getTodayUtcString, getYesterdayUtcString } from "./dates";
import { validateUrlForSsrf } from "./security/ssrf";

const CDN_BASE_URL = process.env.NEXT_PUBLIC_CDN_URL ?? "";

export type PracticeFetchResult =
  | { status: "success"; data: DailyPracticeDocument; resolvedDate: string; isFallback: boolean }
  | { status: "unavailable"; error: string };

/**
 * Sanitizes track / document identifiers to prevent path traversal and SSRF attacks.
 */
export function sanitizeCdnIdentifier(id: string): string {
  if (!id || typeof id !== "string") {
    throw new Error("Identifier must be a non-empty string");
  }
  const clean = id.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
    throw new Error(`Invalid CDN identifier: "${clean}". Only alphanumeric characters, hyphens, and underscores are permitted.`);
  }
  return clean;
}

/**
 * Pure native fetch for roadmap document from static CDN path.
 * Never hits an API route or server-side database.
 */
export async function fetchRoadmapDocument(roadmapId: string): Promise<RoadmapDocument> {
  const safeId = sanitizeCdnIdentifier(roadmapId);
  const url = `${CDN_BASE_URL}/data/roadmap/${safeId}.json`;

  if (CDN_BASE_URL) {
    const ssrfCheck = validateUrlForSsrf(url, { allowHttpInDev: true });
    if (!ssrfCheck.valid) {
      throw new Error(`SSRF Blocked: ${ssrfCheck.reason}`);
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Failed to load roadmap "${safeId}" from CDN: HTTP ${response.status}`);
  }

  const data = (await response.json()) as RoadmapDocument;
  return data;
}

/**
 * Bounded retry practice fetcher:
 * 1. Checks today's UTC date (/data/practice/[track]/[today].json)
 * 2. If 404, retries yesterday's UTC date (/data/practice/[track]/[yesterday].json)
 * 3. If still 404/error, returns explicit "unavailable" state without unbounded loops.
 */
export async function fetchDailyPractice(
  track: string,
  preferredDate?: string
): Promise<PracticeFetchResult> {
  const safeTrack = sanitizeCdnIdentifier(track);
  const targetDate = preferredDate ? preferredDate.replace(/[^0-9-]/g, "") : getTodayUtcString();
  const primaryUrl = `${CDN_BASE_URL}/data/practice/${safeTrack}/${targetDate}.json`;

  if (CDN_BASE_URL) {
    const check = validateUrlForSsrf(primaryUrl, { allowHttpInDev: true });
    if (!check.valid) {
      return { status: "unavailable", error: `SSRF Blocked: ${check.reason}` };
    }
  }

  try {
    const res = await fetch(primaryUrl, {
      headers: { Accept: "application/json" },
      cache: "force-cache",
    });

    if (res.ok) {
      const data = (await res.json()) as DailyPracticeDocument;
      return {
        status: "success",
        data,
        resolvedDate: targetDate,
        isFallback: false,
      };
    }

    if (res.status === 404) {
      // Bounded retry: try yesterday
      const yesterday = getYesterdayUtcString(targetDate);
      const fallbackUrl = `${CDN_BASE_URL}/data/practice/${track}/${yesterday}.json`;

      const fallbackRes = await fetch(fallbackUrl, {
        headers: { Accept: "application/json" },
        cache: "force-cache",
      });

      if (fallbackRes.ok) {
        const fallbackData = (await fallbackRes.json()) as DailyPracticeDocument;
        return {
          status: "success",
          data: fallbackData,
          resolvedDate: yesterday,
          isFallback: true,
        };
      }
    }

    return {
      status: "unavailable",
      error: `Daily practice for track "${track}" is not available for ${targetDate} or prior date.`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "unavailable",
      error: `Network error loading daily practice: ${message}`,
    };
  }
}
