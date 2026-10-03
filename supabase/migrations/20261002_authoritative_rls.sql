-- ==============================================================================
-- Supabase Migration: Authoritative Row-Level Security (RLS) & Identity Mapping
-- ==============================================================================
-- Migration Date: 2026-10-02
-- Status: PRODUCTION READY — HARDENED (Pending Manual SQL Editor Execution)
-- Scope:
-- 1. Identity relationship between auth.users and public.users (auth_user_id bridge)
-- 2. Authoritative identity consistency audit & safe legacy backfill
-- 3. Hardened private.is_owner() SECURITY DEFINER helper (schema-isolated, fixed search_path)
-- 4. Database-level ownership immutability triggers (prevent ID/auth_user_id tampering)
-- 5. Strict cross-user data isolation for users, resumes, practice, roadmaps, telemetry
-- 6. Explicit PostgreSQL privilege grants and revokes (least privilege)
-- 7. Public read-only policy for domain-specific RAG vector collections
-- 8. Service-role isolation for backend administrative operations
-- ==============================================================================

-- ─── 1. Extensions & Schemas ──────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- Private schema for internal security definer functions (hidden from PostgREST API)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

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

-- Ensure additive columns exist if table was pre-existing (non-destructive)
alter table public.users add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
alter table public.users add column if not exists state jsonb not null default '{}'::jsonb;

-- Ensure an index exists on auth_user_id for high-performance join and lookup
create index if not exists users_auth_user_id_idx on public.users(auth_user_id);

-- ─── 3. Authoritative Identity Consistency Audit & Safe Legacy Backfill ───────
-- Audits existing production users, detects missing/duplicate/conflicting accounts in auth.users,
-- verifies pre-existing auth_user_id mappings, and safely links unmapped rows.
do $$
declare
  v_total_users int;
  v_unmapped_users int;
  v_pre_existing_mapped int;
  v_invalid_auth_fk int;
  v_duplicate_auth_mappings int;
  v_email_mismatch_count int;
  v_duplicate_auth_emails int;
  v_duplicate_public_emails int;
  v_missing_auth_matches int;
  v_post_unmapped int;
  v_post_invalid_fk int;
  v_distinct_auth_ids int;
  v_rec record;
begin
  select count(*) into v_total_users from public.users;
  select count(*) into v_unmapped_users from public.users where auth_user_id is null;
  select count(*) into v_pre_existing_mapped from public.users where auth_user_id is not null;

  raise notice 'Starting identity audit: % total users (% mapped, % unmapped)',
    v_total_users, v_pre_existing_mapped, v_unmapped_users;

  -- ---------------------------------------------------------------------------
  -- PHASE A: Audit Pre-Existing Non-Null auth_user_id Values
  -- ---------------------------------------------------------------------------
  if v_pre_existing_mapped > 0 then
    -- A1. Verify all existing auth_user_id exist in auth.users
    select count(*) into v_invalid_auth_fk
    from public.users pu
    where pu.auth_user_id is not null
      and not exists (select 1 from auth.users au where au.id = pu.auth_user_id);

    if v_invalid_auth_fk > 0 then
      for v_rec in (
        select pu.id, pu.email, pu.auth_user_id
        from public.users pu
        where pu.auth_user_id is not null
          and not exists (select 1 from auth.users au where au.id = pu.auth_user_id)
      ) loop
        raise notice 'Dangling auth_user_id in public.users: user_id=%, email=%, auth_user_id=%',
          v_rec.id, v_rec.email, v_rec.auth_user_id;
      end loop;
      raise exception 'ABORT: % public.users record(s) contain auth_user_id not present in auth.users.', v_invalid_auth_fk;
    end if;

    -- A2. Verify 1:1 mapping (no auth.users record maps to more than one public.users record)
    select count(*) into v_duplicate_auth_mappings
    from (
      select auth_user_id
      from public.users
      where auth_user_id is not null
      group by auth_user_id
      having count(*) > 1
    ) dups;

    if v_duplicate_auth_mappings > 0 then
      raise exception 'ABORT: Duplicate pre-existing auth_user_id mappings detected in public.users.';
    end if;

    -- A3. Detect identity divergence: public.users.auth_user_id = auth.users.id but email differs
    select count(*) into v_email_mismatch_count
    from public.users pu
    join auth.users au on pu.auth_user_id = au.id
    where lower(pu.email) <> lower(au.email);

    if v_email_mismatch_count > 0 then
      for v_rec in (
        select pu.id, pu.email as public_email, au.email as auth_email, pu.auth_user_id
        from public.users pu
        join auth.users au on pu.auth_user_id = au.id
        where lower(pu.email) <> lower(au.email)
      ) loop
        raise notice 'Identity email mismatch: public_user=%, auth_user_id=%, public_email=%, auth_email=%',
          v_rec.id, v_rec.auth_user_id, v_rec.public_email, v_rec.auth_email;
      end loop;
      raise exception 'ABORT: Detected % record(s) where auth_user_id matches auth.users.id but email differs. Halting to prevent identity ambiguity.', v_email_mismatch_count;
    end if;
  end if;

  -- ---------------------------------------------------------------------------
  -- PHASE B: Audit Unmapped Legacy Rows (auth_user_id IS NULL)
  -- ---------------------------------------------------------------------------
  if v_unmapped_users > 0 then
    -- B1. Detect duplicate normalized emails in public.users
    select count(*) into v_duplicate_public_emails
    from (
      select lower(email) from public.users group by lower(email) having count(*) > 1
    ) dups;

    if v_duplicate_public_emails > 0 then
      raise exception 'ABORT: Duplicate email addresses detected within public.users.';
    end if;

    -- B2. Detect duplicate accounts in auth.users matching unmapped public.users emails
    select count(*) into v_duplicate_auth_emails
    from (
      select lower(email) as norm_email
      from auth.users
      where lower(email) in (select lower(email) from public.users where auth_user_id is null)
      group by lower(email)
      having count(*) > 1
    ) dups;

    if v_duplicate_auth_emails > 0 then
      raise exception 'ABORT: Ambiguity detected — duplicate accounts in auth.users share the same email address.';
    end if;

    -- B3. Detect unmapped public.users missing from auth.users
    select count(*) into v_missing_auth_matches
    from public.users pu
    where pu.auth_user_id is null
      and not exists (
        select 1 from auth.users au where lower(au.email) = lower(pu.email)
      );

    if v_missing_auth_matches > 0 then
      for v_rec in (
        select id, email from public.users pu
        where pu.auth_user_id is null
          and not exists (select 1 from auth.users au where lower(au.email) = lower(pu.email))
      ) loop
        raise notice 'Unmatched production public.user: id=%, email=%', v_rec.id, v_rec.email;
      end loop;
      raise exception 'ABORT: % public.users record(s) have no corresponding record in auth.users.', v_missing_auth_matches;
    end if;

    -- B4. Safe Backfill: populate auth_user_id strictly where currently null
    update public.users pu
    set auth_user_id = au.id,
        updated_at = now()
    from auth.users au
    where lower(pu.email) = lower(au.email)
      and pu.auth_user_id is null;
  end if;

  -- ---------------------------------------------------------------------------
  -- PHASE C: Post-Backfill Integrity Verification
  -- ---------------------------------------------------------------------------
  -- C1. Verify every single public.users record now has an auth_user_id
  select count(*) into v_post_unmapped from public.users where auth_user_id is null;
  if v_post_unmapped > 0 then
    raise exception 'ABORT: Post-backfill check failed — % user(s) remain unmapped.', v_post_unmapped;
  end if;

  -- C2. Verify every auth_user_id resolves to a valid auth.users row
  select count(*) into v_post_invalid_fk
  from public.users pu
  where not exists (select 1 from auth.users au where au.id = pu.auth_user_id);
  if v_post_invalid_fk > 0 then
    raise exception 'ABORT: Post-backfill check failed — % auth_user_id value(s) do not exist in auth.users.', v_post_invalid_fk;
  end if;

  -- C3. Verify 1:1 strict uniqueness
  select count(distinct auth_user_id) into v_distinct_auth_ids from public.users;
  if v_distinct_auth_ids <> v_total_users then
    raise exception 'ABORT: Post-backfill check failed — auth_user_id is not 1:1 unique across public.users.';
  end if;

  raise notice 'Identity audit and backfill completed successfully: all % user(s) strictly mapped.', v_total_users;
end $$;

-- Enforce uniqueness on auth_user_id across public.users
create unique index if not exists users_auth_user_id_unique_idx on public.users(auth_user_id);

-- ─── 4. Resume Uploads Table Schema ───────────────────────────────────────────
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

-- ─── 5. Practice History Table Schema ─────────────────────────────────────────
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

-- ─── 6. Roadmaps Table Schema ─────────────────────────────────────────────────
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

-- ─── 7. Telemetry Events Table Schema ─────────────────────────────────────────
create table if not exists public.telemetry_events (
  id              uuid primary key default gen_random_uuid(),
  event_id        text unique not null,
  user_id         uuid not null references public.users(id) on delete cascade,
  event_type      text not null,
  payload         jsonb not null default '{}'::jsonb,
  received_at     timestamptz not null default now()
);

-- ─── 8. Public RAG Vector Collections ─────────────────────────────────────────
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

-- ─── 9. Enable Row Level Security (RLS) ───────────────────────────────────────
alter table public.users enable row level security;
alter table public.resume_uploads enable row level security;
alter table public.practice_history enable row level security;
alter table public.roadmaps enable row level security;
alter table public.telemetry_events enable row level security;
alter table public.course_embeddings enable row level security;
alter table public.roadmap_nodes enable row level security;
alter table public.resume_heuristic_embeddings enable row level security;
alter table public.job_embeddings enable row level security;

-- ─── 10. Private Schema SECURITY DEFINER Ownership Function ───────────────────
-- Hardened against search_path injection; hidden from PostgREST schema;
-- Answers strictly: Does record_user_id belong to auth.uid()?
-- Permanent authoritative mechanism: auth.uid() = public.users.auth_user_id.
-- No email-based authorization.
create or replace function private.is_owner(record_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.users
    where public.users.id = record_user_id
      and public.users.auth_user_id = auth.uid()
  );
end;
$$;

-- Restrict function execution: only authenticated sessions through RLS
revoke all on function private.is_owner(uuid) from public;
revoke all on function private.is_owner(uuid) from anon;
grant execute on function private.is_owner(uuid) to authenticated;

-- ─── 11. Database-Level Ownership Immutability Triggers ───────────────────────
-- Prevents clients or malicious queries from mutating public.users.id, auth_user_id,
-- or altering email to an address that does not match verified auth.users.
create or replace function private.protect_user_identity_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id <> old.id then
    raise exception 'Cannot mutate public.users.id';
  end if;
  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'Cannot mutate public.users.auth_user_id';
  end if;
  if lower(new.email) <> lower(old.email) then
    if not exists (select 1 from auth.users where id = new.auth_user_id and lower(email) = lower(new.email)) then
      raise exception 'Cannot mutate public.users.email: email must match verified auth.users account';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_user_identity_mutation on public.users;
create trigger trg_protect_user_identity_mutation
  before update on public.users
  for each row execute function private.protect_user_identity_mutation();

-- ─── 12. Users Table RLS Policies ─────────────────────────────────────────────
-- SELECT: Authenticated users can read strictly their own profile
drop policy if exists "users_select_owner_policy" on public.users;
create policy "users_select_owner_policy" on public.users
  for select to authenticated
  using (auth_user_id = auth.uid());

-- INSERT: Enforces that newly inserted profiles are strictly tied to caller's auth.uid()
drop policy if exists "users_insert_owner_policy" on public.users;
create policy "users_insert_owner_policy" on public.users
  for insert to authenticated
  with check (auth_user_id = auth.uid());

-- UPDATE: Permits updates only to caller's own record; enforces auth_user_id = auth.uid()
drop policy if exists "users_update_owner_policy" on public.users;
create policy "users_update_owner_policy" on public.users
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- DELETE: Permits deletion only of caller's own record
drop policy if exists "users_delete_owner_policy" on public.users;
create policy "users_delete_owner_policy" on public.users
  for delete to authenticated
  using (auth_user_id = auth.uid());

-- ─── 13. User-Scoped Tables RLS Policies (Resumes, Practice, Roadmaps, Telemetry)
-- Resume Uploads
drop policy if exists "resumes_select_owner_policy" on public.resume_uploads;
create policy "resumes_select_owner_policy" on public.resume_uploads
  for select to authenticated using (private.is_owner(user_id));

drop policy if exists "resumes_insert_owner_policy" on public.resume_uploads;
create policy "resumes_insert_owner_policy" on public.resume_uploads
  for insert to authenticated with check (private.is_owner(user_id));

drop policy if exists "resumes_update_owner_policy" on public.resume_uploads;
create policy "resumes_update_owner_policy" on public.resume_uploads
  for update to authenticated using (private.is_owner(user_id)) with check (private.is_owner(user_id));

drop policy if exists "resumes_delete_owner_policy" on public.resume_uploads;
create policy "resumes_delete_owner_policy" on public.resume_uploads
  for delete to authenticated using (private.is_owner(user_id));

-- Practice History
drop policy if exists "practice_select_owner_policy" on public.practice_history;
create policy "practice_select_owner_policy" on public.practice_history
  for select to authenticated using (private.is_owner(user_id));

drop policy if exists "practice_insert_owner_policy" on public.practice_history;
create policy "practice_insert_owner_policy" on public.practice_history
  for insert to authenticated with check (private.is_owner(user_id));

drop policy if exists "practice_update_owner_policy" on public.practice_history;
create policy "practice_update_owner_policy" on public.practice_history
  for update to authenticated using (private.is_owner(user_id)) with check (private.is_owner(user_id));

drop policy if exists "practice_delete_owner_policy" on public.practice_history;
create policy "practice_delete_owner_policy" on public.practice_history
  for delete to authenticated using (private.is_owner(user_id));

-- Roadmaps
drop policy if exists "roadmaps_select_owner_policy" on public.roadmaps;
create policy "roadmaps_select_owner_policy" on public.roadmaps
  for select to authenticated using (private.is_owner(user_id));

drop policy if exists "roadmaps_insert_owner_policy" on public.roadmaps;
create policy "roadmaps_insert_owner_policy" on public.roadmaps
  for insert to authenticated with check (private.is_owner(user_id));

drop policy if exists "roadmaps_update_owner_policy" on public.roadmaps;
create policy "roadmaps_update_owner_policy" on public.roadmaps
  for update to authenticated using (private.is_owner(user_id)) with check (private.is_owner(user_id));

drop policy if exists "roadmaps_delete_owner_policy" on public.roadmaps;
create policy "roadmaps_delete_owner_policy" on public.roadmaps
  for delete to authenticated using (private.is_owner(user_id));

-- Telemetry Events (Append-only for client events)
drop policy if exists "telemetry_select_owner_policy" on public.telemetry_events;
create policy "telemetry_select_owner_policy" on public.telemetry_events
  for select to authenticated using (private.is_owner(user_id));

drop policy if exists "telemetry_insert_owner_policy" on public.telemetry_events;
create policy "telemetry_insert_owner_policy" on public.telemetry_events
  for insert to authenticated with check (private.is_owner(user_id));

-- ─── 14. Public RAG Vector Collections RLS Policies ───────────────────────────
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

-- ─── 15. Explicit PostgreSQL Table Privileges (Least Privilege) ───────────────
-- Revoke all permissions on private user tables from anon and public
revoke all on table public.users from anon, public;
revoke all on table public.resume_uploads from anon, public;
revoke all on table public.practice_history from anon, public;
revoke all on table public.roadmaps from anon, public;
revoke all on table public.telemetry_events from anon, public;

-- Grant required permissions to authenticated users
grant select, insert, update, delete on table public.users to authenticated;
grant select, insert, update, delete on table public.resume_uploads to authenticated;
grant select, insert, update, delete on table public.practice_history to authenticated;
grant select, insert, update, delete on table public.roadmaps to authenticated;
grant select, insert on table public.telemetry_events to authenticated;

-- Grant public read-only access to domain RAG knowledge collections
revoke insert, update, delete on table public.course_embeddings from anon, authenticated, public;
revoke insert, update, delete on table public.roadmap_nodes from anon, authenticated, public;
revoke insert, update, delete on table public.resume_heuristic_embeddings from anon, authenticated, public;
revoke insert, update, delete on table public.job_embeddings from anon, authenticated, public;

grant select on table public.course_embeddings to anon, authenticated;
grant select on table public.roadmap_nodes to anon, authenticated;
grant select on table public.resume_heuristic_embeddings to anon, authenticated;
grant select on table public.job_embeddings to anon, authenticated;

-- Grant full administrative rights on all tables to service_role
grant all on all tables in schema public to service_role;
