-- ==============================================================================
-- Supabase Migration: Authoritative Row-Level Security (RLS) & Identity Mapping
-- ==============================================================================
-- Migration Date: 2026-10-02
-- Status: STAGING READY TO APPLY
-- Scope:
-- 1. Identity relationship between auth.users and public.users (auth_user_id bridge)
-- 2. Strict cross-user data isolation for users, resumes, practice, roadmaps, telemetry
-- 3. Public read-only policy for domain-specific RAG vector collections
-- 4. Service-role isolation for backend administrative operations
-- ==============================================================================

-- ─── 1. Extensions ────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ─── 2. Users Table Schema & Identity Bridge ──────────────────────────────────
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid references auth.users(id) on delete cascade,
  email         text unique not null,
  name          text,
  picture       text,
  auth_provider text not null default 'email',
  target_role   text,
  state         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Ensure columns exist if table was pre-existing
alter table public.users add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
alter table public.users add column if not exists state jsonb not null default '{}'::jsonb;

-- ─── 3. Resume Uploads Table Schema ───────────────────────────────────────────
create table if not exists public.resume_uploads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  filename        text,
  resume_text     text,
  target_role     text,
  ats_score       integer,
  matched_skills  text[],
  missing_skills  text[],
  analysis_json   jsonb,
  uploaded_at     timestamptz not null default now()
);

-- ─── 4. Practice History Table Schema ─────────────────────────────────────────
create table if not exists public.practice_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  track           text not null,
  question_id     text not null,
  user_answer     text,
  score           integer,
  feedback        text,
  struggled_topics text[],
  completed_at    timestamptz not null default now()
);

-- ─── 5. Roadmaps Table Schema ─────────────────────────────────────────────────
create table if not exists public.roadmaps (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  role_id         text not null,
  title           text not null,
  current_step    integer default 1,
  progress        numeric default 0,
  milestones      jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── 6. Telemetry Events Table Schema ─────────────────────────────────────────
create table if not exists public.telemetry_events (
  id              uuid primary key default gen_random_uuid(),
  event_id        text unique not null,
  user_id         uuid not null references public.users(id) on delete cascade,
  event_type      text not null,
  payload         jsonb not null default '{}'::jsonb,
  received_at     timestamptz not null default now()
);

-- ─── 7. Public RAG Vector Collections ─────────────────────────────────────────
create table if not exists public.course_embeddings (
  id text primary key,
  title text not null,
  role text,
  level text,
  provider text,
  url text,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

create table if not exists public.roadmap_nodes (
  id text primary key,
  role text not null,
  step_order int,
  title text not null,
  detail text not null,
  skills text[],
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

create table if not exists public.resume_heuristic_embeddings (
  id text primary key,
  category text not null,
  rule_title text not null,
  guidance text not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

create table if not exists public.job_embeddings (
  id text primary key,
  role text not null,
  company text not null,
  location text,
  remote boolean default false,
  description text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- ─── 8. Enable Row Level Security (RLS) ───────────────────────────────────────
alter table public.users enable row level security;
alter table public.resume_uploads enable row level security;
alter table public.practice_history enable row level security;
alter table public.roadmaps enable row level security;
alter table public.telemetry_events enable row level security;
alter table public.course_embeddings enable row level security;
alter table public.roadmap_nodes enable row level security;
alter table public.resume_heuristic_embeddings enable row level security;
alter table public.job_embeddings enable row level security;

-- ─── 9. Users Table RLS Policies ──────────────────────────────────────────────
drop policy if exists "users_select_owner_policy" on public.users;
create policy "users_select_owner_policy" on public.users
  for select to authenticated
  using (auth.uid() = auth_user_id or email = (auth.jwt() ->> 'email'));

drop policy if exists "users_insert_owner_policy" on public.users;
create policy "users_insert_owner_policy" on public.users
  for insert to authenticated
  with check (auth.uid() = auth_user_id or email = (auth.jwt() ->> 'email'));

drop policy if exists "users_update_owner_policy" on public.users;
create policy "users_update_owner_policy" on public.users
  for update to authenticated
  using (auth.uid() = auth_user_id or email = (auth.jwt() ->> 'email'))
  with check (auth.uid() = auth_user_id or email = (auth.jwt() ->> 'email'));

drop policy if exists "users_delete_owner_policy" on public.users;
create policy "users_delete_owner_policy" on public.users
  for delete to authenticated
  using (auth.uid() = auth_user_id or email = (auth.jwt() ->> 'email'));

-- ─── 10. User-Scoped Tables RLS Policies (Resumes, Practice, Roadmaps, Telemetry)
-- Helper function to verify user ownership
create or replace function public.is_owner(record_user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.users
    where id = record_user_id
      and (auth_user_id = auth.uid() or email = (auth.jwt() ->> 'email'))
  );
end;
$$ language plpgsql security definer;

-- Resume Uploads
drop policy if exists "resumes_select_owner_policy" on public.resume_uploads;
create policy "resumes_select_owner_policy" on public.resume_uploads
  for select to authenticated using (public.is_owner(user_id));

drop policy if exists "resumes_insert_owner_policy" on public.resume_uploads;
create policy "resumes_insert_owner_policy" on public.resume_uploads
  for insert to authenticated with check (public.is_owner(user_id));

drop policy if exists "resumes_update_owner_policy" on public.resume_uploads;
create policy "resumes_update_owner_policy" on public.resume_uploads
  for update to authenticated using (public.is_owner(user_id)) with check (public.is_owner(user_id));

drop policy if exists "resumes_delete_owner_policy" on public.resume_uploads;
create policy "resumes_delete_owner_policy" on public.resume_uploads
  for delete to authenticated using (public.is_owner(user_id));

-- Practice History
drop policy if exists "practice_select_owner_policy" on public.practice_history;
create policy "practice_select_owner_policy" on public.practice_history
  for select to authenticated using (public.is_owner(user_id));

drop policy if exists "practice_insert_owner_policy" on public.practice_history;
create policy "practice_insert_owner_policy" on public.practice_history
  for insert to authenticated with check (public.is_owner(user_id));

drop policy if exists "practice_update_owner_policy" on public.practice_history;
create policy "practice_update_owner_policy" on public.practice_history
  for update to authenticated using (public.is_owner(user_id)) with check (public.is_owner(user_id));

drop policy if exists "practice_delete_owner_policy" on public.practice_history;
create policy "practice_delete_owner_policy" on public.practice_history
  for delete to authenticated using (public.is_owner(user_id));

-- Roadmaps
drop policy if exists "roadmaps_select_owner_policy" on public.roadmaps;
create policy "roadmaps_select_owner_policy" on public.roadmaps
  for select to authenticated using (public.is_owner(user_id));

drop policy if exists "roadmaps_insert_owner_policy" on public.roadmaps;
create policy "roadmaps_insert_owner_policy" on public.roadmaps
  for insert to authenticated with check (public.is_owner(user_id));

drop policy if exists "roadmaps_update_owner_policy" on public.roadmaps;
create policy "roadmaps_update_owner_policy" on public.roadmaps
  for update to authenticated using (public.is_owner(user_id)) with check (public.is_owner(user_id));

drop policy if exists "roadmaps_delete_owner_policy" on public.roadmaps;
create policy "roadmaps_delete_owner_policy" on public.roadmaps
  for delete to authenticated using (public.is_owner(user_id));

-- Telemetry Events
drop policy if exists "telemetry_select_owner_policy" on public.telemetry_events;
create policy "telemetry_select_owner_policy" on public.telemetry_events
  for select to authenticated using (public.is_owner(user_id));

drop policy if exists "telemetry_insert_owner_policy" on public.telemetry_events;
create policy "telemetry_insert_owner_policy" on public.telemetry_events
  for insert to authenticated with check (public.is_owner(user_id));

-- ─── 11. Public RAG Vector Collections RLS Policies ───────────────────────────
-- Public domain collections are read-only to all clients (authenticated and anonymous)
drop policy if exists "rag_courses_public_read" on public.course_embeddings;
create policy "rag_courses_public_read" on public.course_embeddings for select to authenticated, anon using (true);

drop policy if exists "rag_roadmap_public_read" on public.roadmap_nodes;
create policy "rag_roadmap_public_read" on public.roadmap_nodes for select to authenticated, anon using (true);

drop policy if exists "rag_resume_heuristics_public_read" on public.resume_heuristic_embeddings;
create policy "rag_resume_heuristics_public_read" on public.resume_heuristic_embeddings for select to authenticated, anon using (true);

drop policy if exists "rag_jobs_public_read" on public.job_embeddings;
create policy "rag_jobs_public_read" on public.job_embeddings for select to authenticated, anon using (true);

-- Mutations to RAG domain knowledge are strictly restricted to service_role
drop policy if exists "rag_courses_service_write" on public.course_embeddings;
create policy "rag_courses_service_write" on public.course_embeddings for all to service_role using (true) with check (true);

drop policy if exists "rag_roadmap_service_write" on public.roadmap_nodes;
create policy "rag_roadmap_service_write" on public.roadmap_nodes for all to service_role using (true) with check (true);

drop policy if exists "rag_resume_heuristics_service_write" on public.resume_heuristic_embeddings;
create policy "rag_resume_heuristics_service_write" on public.resume_heuristic_embeddings for all to service_role using (true) with check (true);

drop policy if exists "rag_jobs_service_write" on public.job_embeddings;
create policy "rag_jobs_service_write" on public.job_embeddings for all to service_role using (true) with check (true);
