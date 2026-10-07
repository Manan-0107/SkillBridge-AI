/**
 * lib/career/evidenceWallet.ts
 *
 * UBIX Skill Evidence System & Career Evidence Wallet
 *
 * The authoritative repository of verifiable skills, artifacts, and assessments.
 *
 * Evidence Sources:
 * - USER_CONFIRMATION: User explicitly confirmed skill mastery.
 * - RESUME_PARSED: Parsed from uploaded resume document (requires verification).
 * - PROJECT_COMPLETED: Derived from completed, demonstrable project artifacts.
 * - GITHUB_REPOSITORY: Extracted from verified repository analysis.
 * - PRACTICE_ASSESSMENT: Verified through STAR practice or coding challenge score.
 * - WORK_EXPERIENCE: Verified via chronological employment history.
 * - VOLUNTEERING: Community or non-traditional contribution.
 * - OPEN_SOURCE: Merged PRs, commits, or community packages.
 *
 * Invariant: Weak or inferred evidence is never presented as confirmed fact.
 */

import { normalizeSkillName } from "./skillGraph";
import {
  upsertSkillEvidenceDb,
  fetchSkillEvidenceDb,
  deleteSkillEvidenceDb,
} from "../db";

export type EvidenceSourceType =
  | "USER_CONFIRMATION"
  | "RESUME_PARSED"
  | "PROJECT_COMPLETED"
  | "GITHUB_REPOSITORY"
  | "PRACTICE_ASSESSMENT"
  | "WORK_EXPERIENCE"
  | "VOLUNTEERING"
  | "OPEN_SOURCE";

export type EvidenceStatus =
  | "CONFIRMED"
  | "INFERRED"
  | "UNKNOWN"
  | "OUTDATED"
  | "USER_REJECTED";

export interface SkillEvidenceItem {
  id: string;
  userId: string;
  skillId: string;
  skillName: string;
  source: EvidenceSourceType;
  status: EvidenceStatus;
  confidence: number; // 0.0 (unverified heuristic) to 1.0 (authoritative proof)
  title: string;
  description: string;
  artifactUrl?: string;
  createdAt: string;
  verifiedAt?: string;
  rejectionReason?: string;
  provenance?: "CONFIRMED" | "SOURCE_VERIFIED" | "INFERRED" | "UNKNOWN" | "USER_PROVIDED";
  verificationMetadata?: Record<string, unknown>;
}

export type SkillEvidence = SkillEvidenceItem;

// In-memory store: userId -> Map<evidenceId, SkillEvidenceItem>
const userEvidenceStores = new Map<string, Map<string, SkillEvidenceItem>>();

/**
 * Records a piece of skill evidence into the user's Evidence Wallet.
 */
export function recordSkillEvidence(
  params: Omit<SkillEvidenceItem, "id" | "createdAt" | "skillId"> & { skillName: string }
): SkillEvidenceItem {
  if (!params.userId) {
    throw new Error("Evidence Wallet requires an authenticated userId.");
  }

  const skillId = normalizeSkillName(params.skillName);
  let userMap = userEvidenceStores.get(params.userId);
  if (!userMap) {
    userMap = new Map();
    userEvidenceStores.set(params.userId, userMap);
  }

  // Check if an existing item for this skill and source exists
  let existing: SkillEvidenceItem | undefined;
  for (const item of userMap.values()) {
    if (item.skillId === skillId && item.source === params.source && item.title === params.title) {
      existing = item;
      break;
    }
  }

  const now = new Date().toISOString();
  if (existing) {
    if (existing.status === "USER_REJECTED" && params.status === "INFERRED") {
      return existing; // Do not overwrite user rejection
    }
    existing.confidence = params.confidence;
    existing.description = params.description;
    existing.artifactUrl = params.artifactUrl;
    existing.status = params.status;
    if (params.status === "CONFIRMED" && !existing.verifiedAt) {
      existing.verifiedAt = now;
    }
    userMap.set(existing.id, existing);
    upsertSkillEvidenceDb(existing).catch(() => {});
    return existing;
  }

  const newItem: SkillEvidenceItem = {
    id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    skillId,
    createdAt: now,
    verifiedAt: params.status === "CONFIRMED" ? now : undefined,
    ...params,
  };

  userMap.set(newItem.id, newItem);
  upsertSkillEvidenceDb(newItem).catch(() => {});
  return newItem;
}

/**
 * Authoritatively records a piece of skill evidence with database persistence.
 */
export async function recordSkillEvidenceAsync(
  params: Omit<SkillEvidenceItem, "id" | "createdAt" | "skillId"> & { skillName: string }
): Promise<SkillEvidenceItem> {
  const item = recordSkillEvidence(params);
  await upsertSkillEvidenceDb(item);
  return item;
}

/**
 * Confirms an unverified or inferred evidence item.
 */
export function confirmEvidence(userId: string, evidenceId: string): SkillEvidenceItem {
  const userMap = userEvidenceStores.get(userId);
  const item = userMap?.get(evidenceId);
  if (!item) {
    throw new Error("Evidence item not found or does not belong to user.");
  }

  item.status = "CONFIRMED";
  item.confidence = Math.max(item.confidence, 0.9);
  item.verifiedAt = new Date().toISOString();
  userMap?.set(item.id, item);
  upsertSkillEvidenceDb(item).catch(() => {});
  return item;
}

/**
 * Authoritatively confirms an evidence item with database persistence.
 */
export async function confirmEvidenceAsync(userId: string, evidenceId: string): Promise<SkillEvidenceItem> {
  const item = confirmEvidence(userId, evidenceId);
  await upsertSkillEvidenceDb(item);
  return item;
}

/**
 * Rejects an evidence item.
 */
export function rejectEvidence(userId: string, evidenceId: string, reason?: string): SkillEvidenceItem {
  const userMap = userEvidenceStores.get(userId);
  const item = userMap?.get(evidenceId);
  if (!item) {
    throw new Error("Evidence item not found or does not belong to user.");
  }

  item.status = "USER_REJECTED";
  item.rejectionReason = reason || "Rejected by user.";
  userMap?.set(item.id, item);
  upsertSkillEvidenceDb(item).catch(() => {});
  return item;
}

/**
 * Authoritatively rejects an evidence item with database persistence.
 */
export async function rejectEvidenceAsync(userId: string, evidenceId: string, reason?: string): Promise<SkillEvidenceItem> {
  const item = rejectEvidence(userId, evidenceId, reason);
  await upsertSkillEvidenceDb(item);
  return item;
}

/**
 * Deletes an evidence item.
 */
export function deleteSkillEvidence(userId: string, evidenceId: string): boolean {
  const userMap = userEvidenceStores.get(userId);
  const existed = Boolean(userMap && userMap.delete(evidenceId));
  deleteSkillEvidenceDb(userId, evidenceId).catch(() => {});
  return existed;
}

/**
 * Authoritatively deletes an evidence item with database persistence.
 */
export async function deleteSkillEvidenceAsync(userId: string, evidenceId: string): Promise<boolean> {
  deleteSkillEvidence(userId, evidenceId);
  return await deleteSkillEvidenceDb(userId, evidenceId);
}

/**
 * Retrieves all items in a user's Career Evidence Wallet.
 */
export function getUserEvidenceWallet(
  userId: string,
  filter?: { skillId?: string; status?: EvidenceStatus }
): SkillEvidenceItem[] {
  if (!userId) return [];
  const userMap = userEvidenceStores.get(userId);
  if (!userMap) return [];

  let items = Array.from(userMap.values());
  if (filter?.skillId) {
    const target = normalizeSkillName(filter.skillId);
    items = items.filter((i) => i.skillId === target);
  }
  if (filter?.status) {
    items = items.filter((i) => i.status === filter.status);
  }
  return items;
}

/**
 * Authoritatively loads all evidence items from the database.
 */
export async function getUserEvidenceWalletAsync(
  userId: string,
  filter?: { skillId?: string; status?: EvidenceStatus }
): Promise<SkillEvidenceItem[]> {
  if (!userId) return [];
  try {
    const dbRows = await fetchSkillEvidenceDb(userId);
    if (dbRows && Array.isArray(dbRows)) {
      let userMap = userEvidenceStores.get(userId);
      if (!userMap) {
        userMap = new Map();
        userEvidenceStores.set(userId, userMap);
      }
      for (const row of dbRows) {
        userMap.set(row.id, {
          ...row,
          source: row.source as EvidenceSourceType,
          status: row.status as EvidenceStatus,
          provenance: row.provenance as any,
        });
      }
    }
  } catch (err) {
    console.warn("[EvidenceWallet] DB load warning:", (err as any)?.message);
  }

  return getUserEvidenceWallet(userId, filter);
}

/**
 * Aggregates verified skills and computes composite confidence.
 */
export function getVerifiedSkillsForUser(userId: string): {
  skillId: string;
  skillName: string;
  confidence: number;
  evidenceCount: number;
  primarySource: EvidenceSourceType;
}[] {
  const items = getUserEvidenceWallet(userId, { status: "CONFIRMED" });
  const skillMap = new Map<
    string,
    { skillName: string; confidences: number[]; sources: EvidenceSourceType[] }
  >();

  for (const item of items) {
    const entry = skillMap.get(item.skillId) || {
      skillName: item.skillName,
      confidences: [],
      sources: [],
    };
    entry.confidences.push(item.confidence);
    entry.sources.push(item.source);
    skillMap.set(item.skillId, entry);
  }

  return Array.from(skillMap.entries()).map(([skillId, data]) => {
    const avgConfidence =
      data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length;
    return {
      skillId,
      skillName: data.skillName,
      confidence: Number(avgConfidence.toFixed(2)),
      evidenceCount: data.confidences.length,
      primarySource: data.sources[0] || "USER_CONFIRMATION",
    };
  });
}

/**
 * Authoritatively retrieves verified skills using database backing.
 */
export async function getVerifiedSkillsForUserAsync(userId: string) {
  await getUserEvidenceWalletAsync(userId);
  return getVerifiedSkillsForUser(userId);
}

/**
 * Resets evidence stores for unit tests.
 */
export function _resetEvidenceWallet(): void {
  userEvidenceStores.clear();
}
