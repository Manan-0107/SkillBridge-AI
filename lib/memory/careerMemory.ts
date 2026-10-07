/**
 * lib/memory/careerMemory.ts
 *
 * UBIX Personal Career Memory Foundation
 *
 * Maintains structured, user-inspectable career memory with explicit provenance tags:
 * - CONFIRMED: Verified by user or direct authoritative evidence.
 * - INFERRED: Derived by assistant/analysis; explicitly flagged and requires user confirmation.
 * - UNKNOWN: Incomplete or missing context; never fabricated.
 * - OUTDATED: Previously true but superseded by newer evidence.
 * - USER_REJECTED: Explicitly repudiated by the user; permanently excluded from suggestions.
 *
 * Invariant: Never silently promotes INFERRED items to CONFIRMED.
 */

export type MemoryProvenance =
  | "CONFIRMED"
  | "INFERRED"
  | "UNKNOWN"
  | "OUTDATED"
  | "USER_REJECTED";

export type MemoryCategory =
  | "CAREER_GOAL"
  | "CORE_SKILL"
  | "WORK_PREFERENCE"
  | "EXPERIENCE"
  | "CONSTRAINT"
  | "ACHIEVEMENT"
  | "EDUCATION";

export interface CareerMemoryItem {
  id: string;
  userId: string;
  category: MemoryCategory;
  key: string;
  value: string;
  provenance: MemoryProvenance;
  confidence: number; // 0.0 to 1.0
  sourceDescription: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  rejectedReason?: string;
}

import {
  upsertCareerMemoryDb,
  fetchCareerMemoryDb,
  deleteCareerMemoryDb,
} from "../db";

// In-memory memory store: userId -> Map<id, CareerMemoryItem>
const userMemoryStores = new Map<string, Map<string, CareerMemoryItem>>();

/**
 * Records or updates a career memory item with strict provenance.
 */
export function recordMemoryItem(
  params: Omit<CareerMemoryItem, "id" | "createdAt" | "updatedAt">
): CareerMemoryItem {
  if (!params.userId) {
    throw new Error("Career memory requires an authenticated userId.");
  }

  let userMap = userMemoryStores.get(params.userId);
  if (!userMap) {
    userMap = new Map();
    userMemoryStores.set(params.userId, userMap);
  }

  // Check if an existing memory key in this category exists
  let existing: CareerMemoryItem | undefined;
  for (const item of userMap.values()) {
    if (item.category === params.category && item.key.toLowerCase() === params.key.toLowerCase()) {
      existing = item;
      break;
    }
  }

  const now = new Date().toISOString();
  if (existing) {
    // If existing item was USER_REJECTED, do not silently overwrite with INFERRED
    if (existing.provenance === "USER_REJECTED" && params.provenance === "INFERRED") {
      return existing;
    }

    existing.value = params.value;
    existing.provenance = params.provenance;
    existing.confidence = params.confidence;
    existing.sourceDescription = params.sourceDescription;
    existing.updatedAt = now;
    if (params.provenance === "CONFIRMED" && !existing.confirmedAt) {
      existing.confirmedAt = now;
    }
    userMap.set(existing.id, existing);
    upsertCareerMemoryDb(existing).catch(() => {});
    return existing;
  }

  const newItem: CareerMemoryItem = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: now,
    updatedAt: now,
    confirmedAt: params.provenance === "CONFIRMED" ? now : undefined,
    ...params,
  };

  userMap.set(newItem.id, newItem);
  upsertCareerMemoryDb(newItem).catch(() => {});
  return newItem;
}

/**
 * Authoritatively records a career memory item with database persistence.
 */
export async function recordMemoryItemAsync(
  params: Omit<CareerMemoryItem, "id" | "createdAt" | "updatedAt">
): Promise<CareerMemoryItem> {
  const item = recordMemoryItem(params);
  await upsertCareerMemoryDb(item);
  return item;
}

/**
 * Confirms an inferred or suggested career memory item.
 */
export function confirmMemoryItem(userId: string, itemId: string): CareerMemoryItem {
  const userMap = userMemoryStores.get(userId);
  const item = userMap?.get(itemId);
  if (!item) {
    throw new Error("Memory item not found or does not belong to the user.");
  }

  item.provenance = "CONFIRMED";
  item.confidence = 1.0;
  item.confirmedAt = new Date().toISOString();
  item.updatedAt = new Date().toISOString();
  userMap?.set(item.id, item);
  upsertCareerMemoryDb(item).catch(() => {});
  return item;
}

/**
 * Authoritatively confirms an inferred item with database persistence.
 */
export async function confirmMemoryItemAsync(userId: string, itemId: string): Promise<CareerMemoryItem> {
  const item = confirmMemoryItem(userId, itemId);
  await upsertCareerMemoryDb(item);
  return item;
}

/**
 * Rejects an item from career memory.
 */
export function rejectMemoryItem(userId: string, itemId: string, reason?: string): CareerMemoryItem {
  const userMap = userMemoryStores.get(userId);
  const item = userMap?.get(itemId);
  if (!item) {
    throw new Error("Memory item not found or does not belong to the user.");
  }

  item.provenance = "USER_REJECTED";
  item.rejectedReason = reason || "Rejected by user.";
  item.updatedAt = new Date().toISOString();
  userMap?.set(item.id, item);
  upsertCareerMemoryDb(item).catch(() => {});
  return item;
}

/**
 * Authoritatively rejects an item with database persistence.
 */
export async function rejectMemoryItemAsync(userId: string, itemId: string, reason?: string): Promise<CareerMemoryItem> {
  const item = rejectMemoryItem(userId, itemId, reason);
  await upsertCareerMemoryDb(item);
  return item;
}

/**
 * Deletes an item from career memory.
 */
export function deleteMemoryItem(userId: string, itemId: string): boolean {
  const userMap = userMemoryStores.get(userId);
  const existed = Boolean(userMap && userMap.delete(itemId));
  deleteCareerMemoryDb(userId, itemId).catch(() => {});
  return existed;
}

/**
 * Authoritatively deletes an item with database persistence.
 */
export async function deleteMemoryItemAsync(userId: string, itemId: string): Promise<boolean> {
  deleteMemoryItem(userId, itemId);
  return await deleteCareerMemoryDb(userId, itemId);
}

/**
 * Retrieves career memory items for a user, optionally filtered by provenance or category.
 */
export function getUserCareerMemory(
  userId: string,
  filter?: { provenance?: MemoryProvenance; category?: MemoryCategory }
): CareerMemoryItem[] {
  if (!userId) return [];
  const userMap = userMemoryStores.get(userId);
  if (!userMap) return [];

  let items = Array.from(userMap.values());
  if (filter?.provenance) {
    items = items.filter((i) => i.provenance === filter.provenance);
  }
  if (filter?.category) {
    items = items.filter((i) => i.category === filter.category);
  }
  return items;
}

/**
 * Authoritatively loads career memory from the database.
 */
export async function getUserCareerMemoryAsync(
  userId: string,
  filter?: { provenance?: MemoryProvenance; category?: MemoryCategory }
): Promise<CareerMemoryItem[]> {
  if (!userId) return [];
  try {
    const dbRows = await fetchCareerMemoryDb(userId);
    if (dbRows && Array.isArray(dbRows)) {
      let userMap = userMemoryStores.get(userId);
      if (!userMap) {
        userMap = new Map();
        userMemoryStores.set(userId, userMap);
      }
      for (const row of dbRows) {
        userMap.set(row.id, {
          ...row,
          category: row.category as MemoryCategory,
          provenance: row.provenance as MemoryProvenance,
        });
      }
    }
  } catch (err) {
    console.warn("[CareerMemory] DB load warning:", (err as any)?.message);
  }

  return getUserCareerMemory(userId, filter);
}

/**
 * Retrieves only verified, confirmed career facts.
 */
export function getConfirmedCareerFacts(userId: string): CareerMemoryItem[] {
  return getUserCareerMemory(userId, { provenance: "CONFIRMED" });
}

/**
 * Resets memory store for unit testing.
 */
export function _resetCareerMemory(): void {
  userMemoryStores.clear();
}
