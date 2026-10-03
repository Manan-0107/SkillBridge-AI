/**
 * lib/career/careerTimeline.ts
 *
 * UBIX Chronological Career Timeline
 *
 * Unifies all milestones, achievements, practice assessments, applications,
 * and skill evidence into an accessible, filterable chronological timeline.
 */

export type TimelineEventType =
  | "GOAL_SET"
  | "SKILL_VERIFIED"
  | "PROJECT_DELIVERED"
  | "LEARNING_COMPLETED"
  | "PRACTICE_COMPLETED"
  | "RESUME_UPDATED"
  | "APPLICATION_SUBMITTED"
  | "INTERVIEW_SCHEDULED"
  | "OFFER_RECEIVED"
  | "ACHIEVEMENT_UNLOCKED";

export interface TimelineEvent {
  id: string;
  userId: string;
  type: TimelineEventType;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
  provenance: "CONFIRMED_EVENT";
}

// In-memory store: userId -> TimelineEvent[]
const timelineStores = new Map<string, TimelineEvent[]>();

/**
 * Appends an event to the candidate's career timeline.
 */
export function recordTimelineEvent(
  params: Omit<TimelineEvent, "id" | "provenance">
): TimelineEvent {
  if (!params.userId) {
    throw new Error("Timeline event requires authenticated userId.");
  }

  const event: TimelineEvent = {
    id: `tl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    provenance: "CONFIRMED_EVENT",
    ...params,
  };

  const list = timelineStores.get(params.userId) || [];
  list.unshift(event);
  timelineStores.set(params.userId, list);
  return event;
}

/**
 * Retrieves timeline events for a user with optional category and date filtering.
 */
export function getUserCareerTimeline(
  userId: string,
  filter?: {
    type?: TimelineEventType;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): TimelineEvent[] {
  if (!userId) return [];
  let events = timelineStores.get(userId) || [];

  if (filter?.type) {
    events = events.filter((e) => e.type === filter.type);
  }
  if (filter?.startDate) {
    const startMs = new Date(filter.startDate).getTime();
    events = events.filter((e) => new Date(e.timestamp).getTime() >= startMs);
  }
  if (filter?.endDate) {
    const endMs = new Date(filter.endDate).getTime();
    events = events.filter((e) => new Date(e.timestamp).getTime() <= endMs);
  }
  if (filter?.limit) {
    events = events.slice(0, filter.limit);
  }

  return events;
}

/**
 * Resets timeline store for tests.
 */
export function _resetCareerTimeline(): void {
  timelineStores.clear();
}
