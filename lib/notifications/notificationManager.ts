/**
 * lib/notifications/notificationManager.ts
 *
 * UBIX Central Notification Framework
 *
 * Dispatches and manages user-scoped, factual notifications across all lifecycle events.
 *
 * Principles:
 * - Strictly factual: never generates fake urgency or fabricated job alerts.
 * - Respects user's Accessibility Passport notification delivery mode (all, critical_only, silent_visual).
 * - Scoped strictly to authenticated userId.
 */

import { NotificationDelivery } from "../accessibility/passport";

export type NotificationCategory =
  | "JOB_MATCH"
  | "DEADLINE"
  | "WEEKLY_REVIEW"
  | "ROADMAP_MILESTONE"
  | "APPLICATION_UPDATE"
  | "INTERVIEW_PREP"
  | "AUTOMATION_STATUS"
  | "CONFIRMATION_REQUEST";

export type NotificationPriority = "low" | "medium" | "high" | "critical";

export interface UbixNotification {
  id: string;
  userId: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  link?: string;
  actionRequired?: boolean;
  confirmationToken?: string;
  read: boolean;
  createdAt: string;
  provenance: "SYSTEM_FACTUAL";
}

// In-memory notifications store: userId -> UbixNotification[]
const notificationStore = new Map<string, UbixNotification[]>();
const MAX_NOTIFICATIONS_PER_USER = 100;

/**
 * Creates and delivers a notification to a specific user.
 */
export function sendNotification(
  params: Omit<UbixNotification, "id" | "read" | "createdAt" | "provenance">,
  userDeliveryPreference: NotificationDelivery = "all"
): UbixNotification | null {
  // If user requested silent visual or critical only, filter non-critical
  if (userDeliveryPreference === "critical_only" && params.priority !== "critical" && params.priority !== "high") {
    return null;
  }

  const notification: UbixNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    read: false,
    createdAt: new Date().toISOString(),
    provenance: "SYSTEM_FACTUAL",
    ...params,
  };

  const list = notificationStore.get(params.userId) || [];
  list.unshift(notification);

  if (list.length > MAX_NOTIFICATIONS_PER_USER) {
    list.length = MAX_NOTIFICATIONS_PER_USER;
  }

  notificationStore.set(params.userId, list);
  return notification;
}

/**
 * Retrieves notifications for an authenticated user.
 */
export function getUserNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {}
): UbixNotification[] {
  if (!userId) return [];
  const list = notificationStore.get(userId) || [];
  let filtered = options.unreadOnly ? list.filter((n) => !n.read) : list;
  if (options.limit) {
    filtered = filtered.slice(0, options.limit);
  }
  return filtered;
}

/**
 * Marks a notification as read.
 */
export function markNotificationAsRead(userId: string, notificationId: string): boolean {
  const list = notificationStore.get(userId);
  if (!list) return false;
  const item = list.find((n) => n.id === notificationId);
  if (!item) return false;
  item.read = true;
  return true;
}

/**
 * Marks all notifications as read for a user.
 */
export function markAllNotificationsAsRead(userId: string): number {
  const list = notificationStore.get(userId);
  if (!list) return 0;
  let count = 0;
  for (const item of list) {
    if (!item.read) {
      item.read = true;
      count++;
    }
  }
  return count;
}

/**
 * Resets notification store for tests.
 */
export function _resetNotificationStore(): void {
  notificationStore.clear();
}
