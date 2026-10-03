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

import { supabase } from "./supabase";

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
export async function getUserResumes(userId: string): Promise<DbResumeUpload[]> {
  if (!supabase || !userId) return [];

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
    return { uploadId: null, error: "Database client is not configured" };
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
  if (!supabase || !userId || !uploadId) {
    return { success: false, error: "Database not configured or invalid identifiers" };
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

// In-memory fallback stores for local testing / offline development
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
 * Persists a saved job or updates its match analysis for a user.
 */
export async function saveUserSavedJob(
  userId: string,
  savedJob: { id: string; job: any; savedAt: string; lastAnalysis?: any; notes?: string }
): Promise<boolean> {
  if (!userId || !savedJob?.id) return false;

  const current = await getUserSavedJobs(userId);
  const filtered = current.filter((j: any) => j.id !== savedJob.id);
  const updated = [savedJob, ...filtered].slice(0, 50); // Bound to 50 saved jobs

  if (!supabase) {
    localSavedJobsStore.set(userId, updated);
    return true;
  }

  const { error } = await supabase
    .from("users")
    .update({
      state: { saved_jobs: updated },
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("[DB] saveUserSavedJob error:", error.message);
    localSavedJobsStore.set(userId, updated);
    return true;
  }
  return true;
}

/**
 * Deletes a saved job from a user's saved_jobs list.
 */
export async function deleteUserSavedJob(userId: string, jobId: string): Promise<boolean> {
  if (!userId || !jobId) return false;

  const current = await getUserSavedJobs(userId);
  const updated = current.filter((j: any) => j.id !== jobId && j.job?.id !== jobId);

  if (!supabase) {
    localSavedJobsStore.set(userId, updated);
    return true;
  }

  const { error } = await supabase
    .from("users")
    .update({
      state: { saved_jobs: updated },
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("[DB] deleteUserSavedJob error:", error.message);
    localSavedJobsStore.set(userId, updated);
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
 * Persists or updates an ApplicationRecord for a user.
 */
export async function saveUserApplication(
  userId: string,
  application: any
): Promise<boolean> {
  if (!userId || !application?.id) return false;

  const current = await getUserApplications(userId);
  const filtered = current.filter((a: any) => a.id !== application.id);
  const updated = [application, ...filtered].slice(0, 100); // Bound to 100 applications

  if (!supabase) {
    localApplicationsStore.set(userId, updated);
    return true;
  }

  // Preserve existing state fields (voice, accessibility, saved_jobs)
  const { data: userRow } = await supabase
    .from("users")
    .select("state")
    .eq("id", userId)
    .maybeSingle();

  const currentState = (userRow?.state as Record<string, unknown>) || {};

  const { error } = await supabase
    .from("users")
    .update({
      state: { ...currentState, applications: updated },
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("[DB] saveUserApplication error:", error.message);
    localApplicationsStore.set(userId, updated);
    return true;
  }
  return true;
}

/**
 * Deletes a tracked application belonging strictly to the user.
 */
export async function deleteUserApplication(userId: string, applicationId: string): Promise<boolean> {
  if (!userId || !applicationId) return false;

  const current = await getUserApplications(userId);
  const updated = current.filter((a: any) => a.id !== applicationId);

  if (!supabase) {
    localApplicationsStore.set(userId, updated);
    return true;
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("state")
    .eq("id", userId)
    .maybeSingle();

  const currentState = (userRow?.state as Record<string, unknown>) || {};

  const { error } = await supabase
    .from("users")
    .update({
      state: { ...currentState, applications: updated },
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("[DB] deleteUserApplication error:", error.message);
    localApplicationsStore.set(userId, updated);
    return true;
  }
  return true;
}



