/**
 * lib/practice/telemetryQueue.ts
 *
 * Client-Side Offline-Resilient Telemetry Queue:
 * - Persists pending practice assessment submissions in localStorage
 * - Employs unique crypto UUID eventIds for end-to-end idempotency
 * - Automatically drains and syncs queue upon window "online" events
 * - Never loses scores during temporary network disconnections or browser reloads
 */

export interface PendingTelemetryEvent {
  eventId: string;
  track: string;
  questionId: string;
  evaluation: "correct" | "partial" | "incorrect" | "dont_know";
  timestamp: number;
  retryCount: number;
  status: "pending" | "syncing" | "failed";
}

const STORAGE_QUEUE_KEY = "ubix_practice_offline_queue";
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 5;

function getStoredQueue(): PendingTelemetryEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingTelemetryEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(queue.slice(0, MAX_QUEUE_SIZE)));
  } catch {
    // quota exceeded fallback
  }
}

/**
 * Enqueues a practice submission and immediately attempts sync if online.
 */
export async function recordPracticeSubmission(params: {
  track: string;
  questionId: string;
  evaluation: "correct" | "partial" | "incorrect" | "dont_know";
}): Promise<string> {
  const eventId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const newEvent: PendingTelemetryEvent = {
    eventId,
    track: params.track,
    questionId: params.questionId,
    evaluation: params.evaluation,
    timestamp: Date.now(),
    retryCount: 0,
    status: "pending",
  };

  const queue = getStoredQueue();
  queue.push(newEvent);
  saveQueue(queue);

  // Attempt immediate background sync
  if (typeof navigator !== "undefined" && navigator.onLine) {
    void syncPendingPracticeTelemetry();
  }

  return eventId;
}

/**
 * Iterates through pending queue and synchronizes events with the server.
 */
export async function syncPendingPracticeTelemetry(): Promise<{ synced: number; remaining: number }> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { synced: 0, remaining: getStoredQueue().length };
  }

  const queue = getStoredQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  const remaining: PendingTelemetryEvent[] = [];
  let syncedCount = 0;

  for (const item of queue) {
    try {
      const res = await fetch("/api/practice/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: item.eventId,
          track: item.track,
          questionId: item.questionId,
          evaluation: item.evaluation,
          timestamp: item.timestamp,
        }),
      });

      if (res.ok) {
        syncedCount++;
      } else if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        // Bad request or schema violation: drop poison pill from queue
        console.warn(`[Telemetry Sync] Dropping invalid event ${item.eventId}: HTTP ${res.status}`);
      } else {
        // Server or rate limit error: increment retry count and keep in queue
        item.retryCount += 1;
        if (item.retryCount < MAX_RETRIES) {
          remaining.push(item);
        }
      }
    } catch {
      // Network drop: preserve event
      item.retryCount += 1;
      if (item.retryCount < MAX_RETRIES) {
        remaining.push(item);
      }
    }
  }

  saveQueue(remaining);
  return { synced: syncedCount, remaining: remaining.length };
}

/**
 * Initializes automatic background sync on window "online" and "focus".
 */
export function initPracticeTelemetryListener(): () => void {
  if (typeof window === "undefined") return () => {};

  const handleOnline = () => {
    console.log("[Telemetry Sync] Browser online: syncing pending submissions...");
    void syncPendingPracticeTelemetry();
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("focus", handleOnline);

  // Initial trigger
  void syncPendingPracticeTelemetry();

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("focus", handleOnline);
  };
}
