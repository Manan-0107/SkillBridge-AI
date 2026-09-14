/**
 * CDN-First Static JSON Fetcher.
 * Requests static JSON files directly from the CDN / static asset origin with aggressive caching.
 *
 * Architecture Guarantee:
 * - NO database queries
 * - NO server-side API calculation
 * - Cache-Control: public, max-age=86400, immutable
 */

import {
  TrackId,
  DailyPracticePayload,
  StaticRoadmapPayload,
} from "@/types/practiceEngine";

/**
 * Fetches the daily practice payload directly from CDN static storage.
 * URL path: /data/practice/[track]/[YYYY-MM-DD].json with fallback to latest.json
 */
export async function fetchDailyPracticeFromCdn(
  track: TrackId,
  dateStr?: string
): Promise<DailyPracticePayload> {
  const targetDate = dateStr || new Date().toISOString().slice(0, 10);
  const primaryUrl = `/data/practice/${track}/${targetDate}.json`;
  const fallbackUrl = `/data/practice/${track}/latest.json`;

  try {
    const res = await fetch(primaryUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "force-cache",
    });

    if (res.ok) {
      const data: DailyPracticePayload = await res.json();
      if (data && Array.isArray(data.questions) && data.questions.length === 10) {
        return data;
      }
    }
  } catch {
    // Primary date fetch failed, attempt fallback to latest.json
  }

  // Fallback to latest.json
  const fallbackRes = await fetch(fallbackUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "force-cache",
  });

  if (!fallbackRes.ok) {
    throw new Error(
      `Failed to load practice payload for track '${track}' from CDN.`
    );
  }

  const fallbackData: DailyPracticePayload = await fallbackRes.json();
  return fallbackData;
}

/**
 * Fetches the pre-rendered static roadmap tree from CDN static storage.
 * URL path: /data/roadmaps/[track].json
 */
export async function fetchStaticRoadmapFromCdn(
  track: TrackId
): Promise<StaticRoadmapPayload> {
  const url = `/data/roadmaps/${track}.json`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "force-cache",
  });

  if (!res.ok) {
    throw new Error(`Failed to load static roadmap for '${track}' from CDN.`);
  }

  const data: StaticRoadmapPayload = await res.json();
  return data;
}
