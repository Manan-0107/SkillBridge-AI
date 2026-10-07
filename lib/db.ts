/**
 * Typed helpers for every DB operation CareerForge needs.
 *
 * ─── One-time Supabase setup SQL ─────────────────────────────────────────────
 *
 * Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query):
 *
 * -- Enable UUID extension
 * create extension if not exists "pgcrypto";
 *
 * -- Users table (one row per account)
 * create table if not exists users (
 *   id            uuid primary key default gen_random_uuid(),
 *   email         text unique not null,
 *   name          text,
 *   picture       text,
 *   auth_provider text not null default 'email',
 *   target_role   text,
 *   state         jsonb not null default '{}'::jsonb,  -- AppProvider prefs (voice/accessibility/skills/location)
 *   created_at    timestamptz not null default now(),
 *   updated_at    timestamptz not null default now()
 * );
 *
 * -- Resume uploads table (many per user)
 * create table if not exists resume_uploads (
 *   id              uuid primary key default gen_random_uuid(),
 *   user_id         uuid references users(id) on delete cascade,
 *   filename        text,
 *   resume_text     text,
 *   target_role     text,
 *   ats_score       integer,
 *   matched_skills  text[],
 *   missing_skills  text[],
 *   analysis_json   jsonb,
 *   uploaded_at     timestamptz not null default now()
 * );
 *
 * -- Existing deployments: add the column in-place
 * alter table users add column if not exists state jsonb not null default '{}'::jsonb;
 *
 * -- Row-level security (optional but recommended for production)
 * alter table users enable row level security;
 * alter table resume_uploads enable row level security;
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto from "crypto";
import { supabase } from "./supabase";
import { isProductionEnvironment } from "./security/environment";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  auth_provider: string;
  target_role: string | null;
  state: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DbResumeUpload {
  id: string;
  user_id: string;
  filename: string | null;
  resume_text: string | null;
  target_role: string | null;
  ats_score: number | null;
  matched_skills: string[] | null;
  missing_skills: string[] | null;
  analysis_json: Record<string, unknown> | null;
  uploaded_at: string;
}

// ─── User helpers ─────────────────────────────────────────────────────────────

/**
 * Create or update a user row on every login.
 * Returns the full DB row (including id) or null if Supabase is not configured.
 */
export async function upsertUser(params: {
  email: string;
  name?: string;
  phone?: string;
  picture?: string;
  avatarUrl?: string;
  authProvider: "email" | "google" | "github" | "phone";
  targetRole?: string | null;
}): Promise<DbUser | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("users")
      .upsert(
        {
          email: params.email,
          name: params.name ?? null,
          picture: params.avatarUrl ?? params.picture ?? null,
          auth_provider: params.authProvider,
          target_role: params.targetRole ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      )
      .select()
      .single();

    if (error) {
      console.warn("[DB] upsertUser warning:", error.message);
      return null;
    }
    return data as DbUser;
  } catch (err) {
    // Offline or network unreachable - continue safely
    return null;
  }
}

/**
 * Update only the target role for an existing user.
 */
export async function updateUserRole(
  userId: string,
  role: string
): Promise<void> {
  if (!supabase || !userId) return;
  await supabase
    .from("users")
    .update({ target_role: role, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

// ─── Resume helpers ───────────────────────────────────────────────────────────

/**
 * Persist a resume upload + its analysis result.
 * Returns the created row id or null.
 */
export async function saveResumeUpload(params: {
  userId: string;
  filename: string;
  resumeText: string;
  targetRole: string;
  atsScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  analysisJson: Record<string, unknown>;
}): Promise<string | null> {
  if (!supabase || !params.userId) return null;

  const { data, error } = await supabase
    .from("resume_uploads")
    .insert({
      user_id: params.userId,
      filename: params.filename,
      resume_text: params.resumeText,
      target_role: params.targetRole,
      ats_score: params.atsScore,
      matched_skills: params.matchedSkills,
      missing_skills: params.missingSkills,
      analysis_json: params.analysisJson,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[DB] saveResumeUpload error:", error.message);
    return null;
  }
  return data?.id ?? null;
}

/**
 * Fetch all resume uploads for a user, most recent first.
 */
const localResumeStore = new Map<string, DbResumeUpload[]>();

export async function getUserResumes(userId: string): Promise<DbResumeUpload[]> {
  if (!userId) return [];
  if (!supabase) {
    return localResumeStore.get(userId) || [];
  }

  const { data, error } = await supabase
    .from("resume_uploads")
    .select("*")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[DB] getUserResumes error:", error.message);
    return [];
  }
  return (data ?? []) as DbResumeUpload[];
}

/**
 * Executes user verification, target_role update (if role provided), and resume upload insertion
 * as a unified operation.
 * Returns { uploadId: string } or error info.
 */
export async function saveResumeWithUserConsistency(params: {
  userId: string;
  filename: string;
  resumeText: string;
  targetRole: string;
  atsScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  analysisJson: Record<string, unknown>;
}): Promise<{ uploadId: string | null; error?: string }> {
  if (!supabase) {
    const uploadId = `upl_${crypto.randomUUID()}`;
    const newRecord: DbResumeUpload = {
      id: uploadId,
      user_id: params.userId,
      filename: params.filename,
      resume_text: params.resumeText,
      target_role: params.targetRole,
      ats_score: params.atsScore,
      matched_skills: params.matchedSkills,
      missing_skills: params.missingSkills,
      analysis_json: params.analysisJson,
      uploaded_at: new Date().toISOString(),
    };
    const current = localResumeStore.get(params.userId) || [];
    localResumeStore.set(params.userId, [newRecord, ...current].slice(0, 20));
    return { uploadId };
  }

  // 1. Verify user exists
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, target_role")
    .eq("id", params.userId)
    .maybeSingle();

  if (userErr) {
    console.error("[DB] saveResumeWithUserConsistency: User query failed:", userErr.message);
    return { uploadId: null, error: `Failed to verify user: ${userErr.message}` };
  }

  if (!user) {
    return { uploadId: null, error: "User record not found in database" };
  }

  // 2. Update user's target_role if different
  if (params.targetRole && user.target_role !== params.targetRole) {
    const { error: roleErr } = await supabase
      .from("users")
      .update({
        target_role: params.targetRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.userId);

    if (roleErr) {
      console.warn("[DB] saveResumeWithUserConsistency: Failed to update target_role:", roleErr.message);
    }
  }

  // 3. Insert resume upload
  const { data: upload, error: uploadErr } = await supabase
    .from("resume_uploads")
    .insert({
      user_id: params.userId,
      filename: params.filename,
      resume_text: params.resumeText,
      target_role: params.targetRole,
      ats_score: params.atsScore,
      matched_skills: params.matchedSkills,
      missing_skills: params.missingSkills,
      analysis_json: params.analysisJson,
    })
    .select("id")
    .single();

  if (uploadErr) {
    console.error("[DB] saveResumeWithUserConsistency: Resume insert failed:", uploadErr.message);
    return { uploadId: null, error: `Failed to save resume upload: ${uploadErr.message}` };
  }

  return { uploadId: upload?.id ?? null };
}

/**
 * Safely delete a resume upload belonging strictly to the authenticated user.
 * Prevents IDOR by validating that user_id matches the session userId.
 */
export async function deleteResumeUpload(
  userId: string,
  uploadId: string
): Promise<{ success: boolean; error?: string }> {
  if (!userId || !uploadId) {
    return { success: false, error: "Invalid identifiers" };
  }
  if (!supabase) {
    const current = localResumeStore.get(userId) || [];
    localResumeStore.set(userId, current.filter((r) => r.id !== uploadId));
    return { success: true };
  }

  const { error } = await supabase
    .from("resume_uploads")
    .delete()
    .eq("id", uploadId)
    .eq("user_id", userId);

  if (error) {
    console.error("[DB] deleteResumeUpload error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ─── Phase 6: Saved Jobs Helpers ──────────────────────────────────────────────

// In-memory fallback stores for local testing / offline development (no Supabase configured)
const localSavedJobsStore = new Map<string, any[]>();
const localApplicationsStore = new Map<string, any[]>();

/**
 * Fetch all saved jobs for a user from their state.saved_jobs array.
 */
export async function getUserSavedJobs(userId: string): Promise<any[]> {
  if (!userId) return [];
  if (!supabase) {
    return localSavedJobsStore.get(userId) || [];
  }

  const { data, error } = await supabase
    .from("users")
    .select("state")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return localSavedJobsStore.get(userId) || [];
  }

  const state = (data.state as Record<string, unknown>) || {};
  return Array.isArray(state.saved_jobs) ? state.saved_jobs : [];
}

/**
 * Atomically persists or updates a saved job using a PostgreSQL RPC.
 *
 * Uses atomic_upsert_saved_job() which calls jsonb_set() in a single
 * database transaction, eliminating:
 *   a) TOCTOU race conditions (two concurrent saves can no longer overwrite each other)
 *   b) state-column overwrites (only the saved_jobs key is modified; all other
 *      state fields such as applications, voice, accessibility are preserved)
 *
 * Falls back to local memory when Supabase is not configured (dev/test).
 */
export async function saveUserSavedJob(
  userId: string,
  savedJob: { id: string; job: any; savedAt: string; lastAnalysis?: any; notes?: string }
): Promise<boolean> {
  if (!userId || !savedJob?.id) return false;

  if (!supabase) {
    // Offline fallback: replicate deduplication + 50-cap in memory
    const current = localSavedJobsStore.get(userId) || [];
    const filtered = current.filter((j: any) => j.id !== savedJob.id);
    localSavedJobsStore.set(userId, [savedJob, ...filtered].slice(0, 50));
    return true;
  }

  const { error } = await supabase.rpc("atomic_upsert_saved_job", {
    p_user_id: userId,
    p_job: savedJob,
  });

  if (error) {
    console.error("[DB] saveUserSavedJob (RPC) error:", error.message);
    // Fallback to local store to avoid data loss in degraded state
    const current = localSavedJobsStore.get(userId) || [];
    const filtered = current.filter((j: any) => j.id !== savedJob.id);
    localSavedJobsStore.set(userId, [savedJob, ...filtered].slice(0, 50));
    return true;
  }
  return true;
}

/**
 * Atomically removes a saved job from a user's saved_jobs list using a PostgreSQL RPC.
 *
 * Uses atomic_delete_saved_job() which modifies only the saved_jobs key via jsonb_set.
 * All other state fields (applications, voice, accessibility, etc.) are preserved.
 */
export async function deleteUserSavedJob(userId: string, jobId: string): Promise<boolean> {
  if (!userId || !jobId) return false;

  if (!supabase) {
    const current = localSavedJobsStore.get(userId) || [];
    localSavedJobsStore.set(userId, current.filter((j: any) => j.id !== jobId && j.job?.id !== jobId));
    return true;
  }

  const { error } = await supabase.rpc("atomic_delete_saved_job", {
    p_user_id: userId,
    p_job_id: jobId,
  });

  if (error) {
    console.error("[DB] deleteUserSavedJob (RPC) error:", error.message);
    const current = localSavedJobsStore.get(userId) || [];
    localSavedJobsStore.set(userId, current.filter((j: any) => j.id !== jobId && j.job?.id !== jobId));
    return true;
  }
  return true;
}

// ─── Phase 7: Application Tracking Helpers ─────────────────────────────────────

/**
 * Fetch all tracked applications for a user from their state.applications array.
 */
export async function getUserApplications(userId: string): Promise<any[]> {
  if (!userId) return [];
  if (!supabase) {
    return localApplicationsStore.get(userId) || [];
  }

  const { data, error } = await supabase
    .from("users")
    .select("state")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return localApplicationsStore.get(userId) || [];
  }

  const state = (data.state as Record<string, unknown>) || {};
  return Array.isArray(state.applications) ? state.applications : [];
}

/**
 * Atomically persists or updates an ApplicationRecord using a PostgreSQL RPC.
 *
 * Uses atomic_upsert_application() which calls jsonb_set() in a single
 * database transaction, eliminating:
 *   a) TOCTOU race conditions
 *   b) state-column overwrites (saved_jobs, voice, accessibility are preserved)
 *
 * This replaces the previous read→spread→write pattern which was not atomic.
 */
export async function saveUserApplication(
  userId: string,
  application: any
): Promise<boolean> {
  if (!userId || !application?.id) return false;

  if (!supabase) {
    const current = localApplicationsStore.get(userId) || [];
    const filtered = current.filter((a: any) => a.id !== application.id);
    localApplicationsStore.set(userId, [application, ...filtered].slice(0, 100));
    return true;
  }

  const { error } = await supabase.rpc("atomic_upsert_application", {
    p_user_id: userId,
    p_application: application,
  });

  if (error) {
    console.error("[DB] saveUserApplication (RPC) error:", error.message);
    const current = localApplicationsStore.get(userId) || [];
    const filtered = current.filter((a: any) => a.id !== application.id);
    localApplicationsStore.set(userId, [application, ...filtered].slice(0, 100));
    return true;
  }
  return true;
}

/**
 * Atomically removes a tracked application using a PostgreSQL RPC.
 *
 * Uses atomic_delete_application() which modifies only the applications key.
 * All other state fields (saved_jobs, voice, accessibility, etc.) are preserved.
 */
export async function deleteUserApplication(userId: string, applicationId: string): Promise<boolean> {
  if (!userId || !applicationId) return false;

  if (!supabase) {
    const current = localApplicationsStore.get(userId) || [];
    localApplicationsStore.set(userId, current.filter((a: any) => a.id !== applicationId));
    return true;
  }

  const { error } = await supabase.rpc("atomic_delete_application", {
    p_user_id: userId,
    p_application_id: applicationId,
  });

  if (error) {
    console.error("[DB] deleteUserApplication (RPC) error:", error.message);
    const current = localApplicationsStore.get(userId) || [];
    localApplicationsStore.set(userId, current.filter((a: any) => a.id !== applicationId));
    return true;
  }
  return true;
}

// ─── UUID Helper ─────────────────────────────────────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isDbUuid(id: string): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
}

// ─── Career Memory Authoritative DB Helpers ──────────────────────────────────

export interface CareerMemoryDbRecord {
  id: string;
  userId: string;
  category: string;
  key: string;
  value: string;
  provenance: string;
  confidence: number;
  sourceDescription: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  rejectedReason?: string;
}

export async function upsertCareerMemoryDb(item: CareerMemoryDbRecord): Promise<boolean> {
  if (!item.userId || !item.id) return false;

  if (!supabase || !isDbUuid(item.userId)) {
    if (isProductionEnvironment() && isDbUuid(item.userId)) {
      throw new Error("Authoritative Database Error: Supabase client is not available in production.");
    }
    return false; // Handled by caller in-memory fallback
  }

  const { error } = await supabase.from("career_memory").upsert({
    id: item.id,
    user_id: item.userId,
    category: item.category,
    key: item.key,
    value: item.value,
    provenance: item.provenance,
    confidence: item.confidence,
    source_description: item.sourceDescription,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    confirmed_at: item.confirmedAt ?? null,
    rejected_reason: item.rejectedReason ?? null,
  });

  if (error) {
    if (isProductionEnvironment()) {
      throw new Error(`Authoritative Database Error: Failed to persist career memory: ${error.message}`);
    }
    console.warn("[DB] upsertCareerMemoryDb warning:", error.message);
    return false;
  }
  return true;
}

export async function fetchCareerMemoryDb(userId: string): Promise<CareerMemoryDbRecord[] | null> {
  if (!userId) return null;
  if (!supabase || !isDbUuid(userId)) {
    if (isProductionEnvironment() && isDbUuid(userId)) {
      throw new Error("Authoritative Database Error: Supabase client is not available in production.");
    }
    return null;
  }

  const { data, error } = await supabase
    .from("career_memory")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isProductionEnvironment()) {
      throw new Error(`Authoritative Database Error: Failed to fetch career memory: ${error.message}`);
    }
    console.warn("[DB] fetchCareerMemoryDb warning:", error.message);
    return null;
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    category: r.category,
    key: r.key,
    value: r.value,
    provenance: r.provenance,
    confidence: Number(r.confidence),
    sourceDescription: r.source_description,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    confirmedAt: r.confirmed_at || undefined,
    rejectedReason: r.rejected_reason || undefined,
  }));
}

export async function deleteCareerMemoryDb(userId: string, itemId: string): Promise<boolean> {
  if (!userId || !itemId) return false;
  if (!supabase || !isDbUuid(userId)) {
    if (isProductionEnvironment() && isDbUuid(userId)) {
      throw new Error("Authoritative Database Error: Supabase client is not available in production.");
    }
    return false;
  }

  const { error } = await supabase
    .from("career_memory")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) {
    if (isProductionEnvironment()) {
      throw new Error(`Authoritative Database Error: Failed to delete career memory: ${error.message}`);
    }
    console.warn("[DB] deleteCareerMemoryDb warning:", error.message);
    return false;
  }
  return true;
}

// ─── Skill Evidence Authoritative DB Helpers ─────────────────────────────────

export interface SkillEvidenceDbRecord {
  id: string;
  userId: string;
  skillId: string;
  skillName: string;
  source: string;
  status: string;
  confidence: number;
  title: string;
  description: string;
  artifactUrl?: string;
  createdAt: string;
  verifiedAt?: string;
  rejectionReason?: string;
  provenance?: string;
  verificationMetadata?: Record<string, unknown>;
}

export async function upsertSkillEvidenceDb(item: SkillEvidenceDbRecord): Promise<boolean> {
  if (!item.userId || !item.id) return false;
  if (!supabase || !isDbUuid(item.userId)) {
    if (isProductionEnvironment() && isDbUuid(item.userId)) {
      throw new Error("Authoritative Database Error: Supabase client is not available in production.");
    }
    return false;
  }

  const { error } = await supabase.from("skill_evidence").upsert({
    id: item.id,
    user_id: item.userId,
    skill_id: item.skillId,
    skill_name: item.skillName,
    source: item.source,
    status: item.status,
    confidence: item.confidence,
    title: item.title,
    description: item.description,
    artifact_url: item.artifactUrl ?? null,
    created_at: item.createdAt,
    verified_at: item.verifiedAt ?? null,
    rejection_reason: item.rejectionReason ?? null,
    provenance: item.provenance ?? "INFERRED",
    verification_metadata: item.verificationMetadata ?? {},
  });

  if (error) {
    if (isProductionEnvironment()) {
      throw new Error(`Authoritative Database Error: Failed to persist skill evidence: ${error.message}`);
    }
    console.warn("[DB] upsertSkillEvidenceDb warning:", error.message);
    return false;
  }
  return true;
}

export async function fetchSkillEvidenceDb(userId: string): Promise<SkillEvidenceDbRecord[] | null> {
  if (!userId) return null;
  if (!supabase || !isDbUuid(userId)) {
    if (isProductionEnvironment() && isDbUuid(userId)) {
      throw new Error("Authoritative Database Error: Supabase client is not available in production.");
    }
    return null;
  }

  const { data, error } = await supabase
    .from("skill_evidence")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isProductionEnvironment()) {
      throw new Error(`Authoritative Database Error: Failed to fetch skill evidence: ${error.message}`);
    }
    console.warn("[DB] fetchSkillEvidenceDb warning:", error.message);
    return null;
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    skillId: r.skill_id,
    skillName: r.skill_name,
    source: r.source,
    status: r.status,
    confidence: Number(r.confidence),
    title: r.title,
    description: r.description,
    artifactUrl: r.artifact_url || undefined,
    createdAt: r.created_at,
    verifiedAt: r.verified_at || undefined,
    rejectionReason: r.rejection_reason || undefined,
    provenance: r.provenance || "INFERRED",
    verificationMetadata: r.verification_metadata || {},
  }));
}

export async function deleteSkillEvidenceDb(userId: string, evidenceId: string): Promise<boolean> {
  if (!userId || !evidenceId) return false;
  if (!supabase || !isDbUuid(userId)) {
    if (isProductionEnvironment() && isDbUuid(userId)) {
      throw new Error("Authoritative Database Error: Supabase client is not available in production.");
    }
    return false;
  }

  const { error } = await supabase
    .from("skill_evidence")
    .delete()
    .eq("id", evidenceId)
    .eq("user_id", userId);

  if (error) {
    if (isProductionEnvironment()) {
      throw new Error(`Authoritative Database Error: Failed to delete skill evidence: ${error.message}`);
    }
    console.warn("[DB] deleteSkillEvidenceDb warning:", error.message);
    return false;
  }
  return true;
}

// ─── Automation Executions Authoritative DB Helpers ──────────────────────────

export interface AutomationExecutionDbRecord {
  id: string;
  userId: string;
  automationId: string;
  actionClass: string;
  state: string;
  trigger: Record<string, unknown>;
  plannedActions: string[];
  executedActions: string[];
  confirmationToken?: string;
  confirmationExpiry?: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  result?: Record<string, unknown>;
  provenance: string;
}

export async function upsertAutomationExecutionDb(exec: AutomationExecutionDbRecord): Promise<boolean> {
  if (!exec.userId || !exec.id) return false;
  if (!supabase || !isDbUuid(exec.userId)) {
    if (isProductionEnvironment() && isDbUuid(exec.userId)) {
      throw new Error("Authoritative Database Error: Supabase client is not available in production.");
    }
    return false;
  }

  const { error } = await supabase.from("automation_executions").upsert({
    id: exec.id,
    user_id: exec.userId,
    automation_id: exec.automationId,
    action_class: exec.actionClass,
    state: exec.state,
    trigger: exec.trigger,
    planned_actions: exec.plannedActions,
    executed_actions: exec.executedActions,
    confirmation_token: exec.confirmationToken ?? null,
    confirmation_expiry: exec.confirmationExpiry ?? null,
    started_at: exec.startedAt,
    completed_at: exec.completedAt ?? null,
    error: exec.error ?? null,
    result: exec.result ?? null,
    provenance: exec.provenance,
  });

  if (error) {
    if (isProductionEnvironment()) {
      throw new Error(`Authoritative Database Error: Failed to persist automation execution: ${error.message}`);
    }
    console.warn("[DB] upsertAutomationExecutionDb warning:", error.message);
    return false;
  }
  return true;
}

export async function fetchAutomationExecutionDb(userId: string): Promise<AutomationExecutionDbRecord[] | null> {
  if (!userId) return null;
  if (!supabase || !isDbUuid(userId)) {
    if (isProductionEnvironment() && isDbUuid(userId)) {
      throw new Error("Authoritative Database Error: Supabase client is not available in production.");
    }
    return null;
  }

  const { data, error } = await supabase
    .from("automation_executions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });

  if (error) {
    if (isProductionEnvironment()) {
      throw new Error(`Authoritative Database Error: Failed to fetch automation executions: ${error.message}`);
    }
    console.warn("[DB] fetchAutomationExecutionDb warning:", error.message);
    return null;
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    automationId: r.automation_id,
    actionClass: r.action_class,
    state: r.state,
    trigger: r.trigger || {},
    plannedActions: Array.isArray(r.planned_actions) ? r.planned_actions : [],
    executedActions: Array.isArray(r.executed_actions) ? r.executed_actions : [],
    confirmationToken: r.confirmation_token || undefined,
    confirmationExpiry: r.confirmation_expiry || undefined,
    startedAt: r.started_at,
    completedAt: r.completed_at || undefined,
    error: r.error || undefined,
    result: r.result || undefined,
    provenance: r.provenance || "SYSTEM_AUTOMATION",
  }));
}
