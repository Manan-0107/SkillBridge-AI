-- ==============================================================================
-- Supabase Migration: Authoritative Row-Level Security (RLS) & Identity Mapping
-- ==============================================================================
-- Migration Date: 2026-10-02
-- Scope:
-- 1. Identity relationship between auth.users and public.users
-- 2. Strict cross-user data isolation for users and resume_uploads
-- 3. Public read-only policy for domain-specific RAG vector collections
-- 4. Service-role isolation for backend batch operations
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

-- Ensure auth_user_id column exists if table was pre-existing
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

-- ─── 4. Enable Row Level Security (RLS) ───────────────────────────────────────
alter table public.users enable row level security;
alter table public.resume_uploads enable row level security;

-- ─── 5. Users Table RLS Policies ──────────────────────────────────────────────
-- Policy: Users can only view their own user account
create policy "users_select_owner_policy"
  on public.users
  for select
  to authenticated
  using (
    auth.uid() = auth_user_id
    or email = (auth.jwt() ->> 'email')
  );

-- Policy: Users can only insert their own user account
create policy "users_insert_owner_policy"
  on public.users
  for insert
  to authenticated
  with check (
    auth.uid() = auth_user_id
    or email = (auth.jwt() ->> 'email')
  );

-- Policy: Users can only update their own user account
create policy "users_update_owner_policy"
  on public.users
  for update
  to authenticated
  using (
    auth.uid() = auth_user_id
    or email = (auth.jwt() ->> 'email')
  )
  with check (
    auth.uid() = auth_user_id
    or email = (auth.jwt() ->> 'email')
  );

-- Policy: Users can only delete their own user account
create policy "users_delete_owner_policy"
  on public.users
  for delete
  to authenticated
  using (
    auth.uid() = auth_user_id
    or email = (auth.jwt() ->> 'email')
  );

-- ─── 6. Resume Uploads Table RLS Policies ─────────────────────────────────────
-- Policy: Users can only select their own resumes
create policy "resumes_select_owner_policy"
  on public.resume_uploads
  for select
  to authenticated
  using (
    user_id in (
      select id from public.users
      where auth.uid() = auth_user_id or email = (auth.jwt() ->> 'email')
    )
  );

-- Policy: Users can only insert their own resumes
create policy "resumes_insert_owner_policy"
  on public.resume_uploads
  for insert
  to authenticated
  with check (
    user_id in (
      select id from public.users
      where auth.uid() = auth_user_id or email = (auth.jwt() ->> 'email')
    )
  );

-- Policy: Users can only update their own resumes
create policy "resumes_update_owner_policy"
  on public.resume_uploads
  for update
  to authenticated
  using (
    user_id in (
      select id from public.users
      where auth.uid() = auth_user_id or email = (auth.jwt() ->> 'email')
    )
  )
  with check (
    user_id in (
      select id from public.users
      where auth.uid() = auth_user_id or email = (auth.jwt() ->> 'email')
    )
  );

-- Policy: Users can only delete their own resumes
create policy "resumes_delete_owner_policy"
  on public.resume_uploads
  for delete
  to authenticated
  using (
    user_id in (
      select id from public.users
      where auth.uid() = auth_user_id or email = (auth.jwt() ->> 'email')
    )
  );

-- ─── 7. Public RAG Vector Collections RLS Policies ───────────────────────────
-- Public domain collections are read-only to all authenticated and anonymous clients
alter table public.course_embeddings enable row level security;
alter table public.roadmap_nodes enable row level security;
alter table public.resume_heuristic_embeddings enable row level security;
alter table public.job_embeddings enable row level security;

create policy "rag_courses_public_read" on public.course_embeddings for select to authenticated, anon using (true);
create policy "rag_roadmap_public_read" on public.roadmap_nodes for select to authenticated, anon using (true);
create policy "rag_resume_heuristics_public_read" on public.resume_heuristic_embeddings for select to authenticated, anon using (true);
create policy "rag_jobs_public_read" on public.job_embeddings for select to authenticated, anon using (true);

-- Mutations to RAG domain knowledge are strictly restricted to service_role
create policy "rag_courses_service_write" on public.course_embeddings for all to service_role using (true) with check (true);
create policy "rag_roadmap_service_write" on public.roadmap_nodes for all to service_role using (true) with check (true);
create policy "rag_resume_heuristics_service_write" on public.resume_heuristic_embeddings for all to service_role using (true) with check (true);
create policy "rag_jobs_service_write" on public.job_embeddings for all to service_role using (true) with check (true);
