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
    console.error("[DB] upsertUser error:", error.message);
    return null;
  }
  return data as DbUser;
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
