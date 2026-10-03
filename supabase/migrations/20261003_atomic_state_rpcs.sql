-- ==============================================================================
-- Migration: Atomic User State JSONB Mutations (Phase 3.5 & 3.6 Hardening)
-- ==============================================================================
-- Date: 2026-10-03
-- Purpose:
--   Eliminate TOCTOU race conditions and partial-state overwrites in the
--   JavaScript-level read→modify→write pattern used in lib/db.ts.
--
--   These RPC functions run entirely inside PostgreSQL, making the
--   read+merge+write atomic within a single transaction.
--
-- Security model:
--   - Functions are SECURITY DEFINER with fixed search_path to prevent
--     privilege escalation or search-path injection.
--   - If invoked in an authenticated context, p_user_id is strictly verified
--     against auth.uid() before any mutation.
--   - Functions are NOT exposed to anon or authenticated clients via PostgREST.
--   - Execute grant is restricted strictly to service_role (used by server route handlers).
--   - RLS on public.users remains in effect and is not weakened.
--   - No arbitrary state key can be mutated — only saved_jobs and
--     applications keys are addressable via these functions.
-- ==============================================================================

-- ─── 1. Atomic Saved-Jobs Mutation ─────────────────────────────────────────────
-- Atomically upserts a saved-job entry into state->'saved_jobs'.
-- Only the saved_jobs array is touched; all other state keys are preserved.
-- Enforces a maximum of 50 entries (most recent first).

create or replace function public.atomic_upsert_saved_job(
  p_user_id  uuid,
  p_job      jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id     text;
  v_current    jsonb;
  v_filtered   jsonb;
  v_updated    jsonb;
begin
  -- Validate required fields
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  -- Defense-in-depth: if invoked under an authenticated client role, prevent mutating another user's state
  if auth.role() = 'authenticated' and auth.uid() <> p_user_id then
    raise exception 'Unauthorized: cannot mutate another user state';
  end if;

  if p_job is null or (p_job->>'id') is null then
    raise exception 'p_job must include an id field';
  end if;

  v_job_id := p_job->>'id';

  -- Atomically read the current saved_jobs array from the user's own row
  select coalesce(state->'saved_jobs', '[]'::jsonb)
    into v_current
    from public.users
   where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  -- Remove any existing entry with the same id (deduplication)
  select coalesce(
    (select jsonb_agg(elem)
       from jsonb_array_elements(v_current) elem
      where (elem->>'id') <> v_job_id),
    '[]'::jsonb
  ) into v_filtered;

  -- Prepend new entry and cap at 50
  v_updated := (
    select jsonb_agg(elem)
      from (
        select p_job as elem
        union all
        select elem
          from jsonb_array_elements(v_filtered) elem
         limit 49
      ) sub
  );

  if v_updated is null then
    v_updated := jsonb_build_array(p_job);
  end if;

  -- Atomically merge ONLY the saved_jobs key; all other state fields are preserved
  update public.users
     set state      = jsonb_set(coalesce(state, '{}'::jsonb), '{saved_jobs}', v_updated, true),
         updated_at = now()
   where id = p_user_id;
end;
$$;

-- Revoke from public, anon, and authenticated to prevent unauthorized direct client invocation
revoke all on function public.atomic_upsert_saved_job(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.atomic_upsert_saved_job(uuid, jsonb) to service_role;


-- ─── 2. Atomic Saved-Job Deletion ──────────────────────────────────────────────
-- Atomically removes a single saved-job entry from state->'saved_jobs' by job id.
-- All other state keys are preserved.

create or replace function public.atomic_delete_saved_job(
  p_user_id  uuid,
  p_job_id   text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current  jsonb;
  v_updated  jsonb;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  -- Defense-in-depth: if invoked under an authenticated client role, prevent mutating another user's state
  if auth.role() = 'authenticated' and auth.uid() <> p_user_id then
    raise exception 'Unauthorized: cannot mutate another user state';
  end if;

  if p_job_id is null or p_job_id = '' then
    raise exception 'p_job_id is required';
  end if;

  select coalesce(state->'saved_jobs', '[]'::jsonb)
    into v_current
    from public.users
   where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  -- Remove all entries matching the job id
  select coalesce(
    (select jsonb_agg(elem)
       from jsonb_array_elements(v_current) elem
      where (elem->>'id') <> p_job_id
        and (elem->'job'->>'id') <> p_job_id),
    '[]'::jsonb
  ) into v_updated;

  if v_updated is null then
    v_updated := '[]'::jsonb;
  end if;

  -- Atomically merge ONLY the saved_jobs key
  update public.users
     set state      = jsonb_set(coalesce(state, '{}'::jsonb), '{saved_jobs}', v_updated, true),
         updated_at = now()
   where id = p_user_id;
end;
$$;

revoke all on function public.atomic_delete_saved_job(uuid, text) from public, anon, authenticated;
grant execute on function public.atomic_delete_saved_job(uuid, text) to service_role;


-- ─── 3. Atomic Application Upsert ──────────────────────────────────────────────
-- Atomically upserts an application record into state->'applications'.
-- Only the applications array is touched; all other state keys are preserved.
-- Enforces a maximum of 100 entries (most recent first).

create or replace function public.atomic_upsert_application(
  p_user_id      uuid,
  p_application  jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app_id   text;
  v_current  jsonb;
  v_filtered jsonb;
  v_updated  jsonb;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  -- Defense-in-depth: if invoked under an authenticated client role, prevent mutating another user's state
  if auth.role() = 'authenticated' and auth.uid() <> p_user_id then
    raise exception 'Unauthorized: cannot mutate another user state';
  end if;

  if p_application is null or (p_application->>'id') is null then
    raise exception 'p_application must include an id field';
  end if;

  v_app_id := p_application->>'id';

  select coalesce(state->'applications', '[]'::jsonb)
    into v_current
    from public.users
   where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  -- Remove existing entry with same id (deduplication)
  select coalesce(
    (select jsonb_agg(elem)
       from jsonb_array_elements(v_current) elem
      where (elem->>'id') <> v_app_id),
    '[]'::jsonb
  ) into v_filtered;

  -- Prepend new entry and cap at 100
  v_updated := (
    select jsonb_agg(elem)
      from (
        select p_application as elem
        union all
        select elem
          from jsonb_array_elements(v_filtered) elem
         limit 99
      ) sub
  );

  if v_updated is null then
    v_updated := jsonb_build_array(p_application);
  end if;

  -- Atomically merge ONLY the applications key
  update public.users
     set state      = jsonb_set(coalesce(state, '{}'::jsonb), '{applications}', v_updated, true),
         updated_at = now()
   where id = p_user_id;
end;
$$;

revoke all on function public.atomic_upsert_application(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.atomic_upsert_application(uuid, jsonb) to service_role;


-- ─── 4. Atomic Application Deletion ────────────────────────────────────────────
-- Atomically removes a single application entry from state->'applications' by id.
-- All other state keys are preserved.

create or replace function public.atomic_delete_application(
  p_user_id        uuid,
  p_application_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current  jsonb;
  v_updated  jsonb;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  -- Defense-in-depth: if invoked under an authenticated client role, prevent mutating another user's state
  if auth.role() = 'authenticated' and auth.uid() <> p_user_id then
    raise exception 'Unauthorized: cannot mutate another user state';
  end if;

  if p_application_id is null or p_application_id = '' then
    raise exception 'p_application_id is required';
  end if;

  select coalesce(state->'applications', '[]'::jsonb)
    into v_current
    from public.users
   where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  select coalesce(
    (select jsonb_agg(elem)
       from jsonb_array_elements(v_current) elem
      where (elem->>'id') <> p_application_id),
    '[]'::jsonb
  ) into v_updated;

  if v_updated is null then
    v_updated := '[]'::jsonb;
  end if;

  -- Atomically merge ONLY the applications key
  update public.users
     set state      = jsonb_set(coalesce(state, '{}'::jsonb), '{applications}', v_updated, true),
         updated_at = now()
   where id = p_user_id;
end;
$$;

revoke all on function public.atomic_delete_application(uuid, text) from public, anon, authenticated;
grant execute on function public.atomic_delete_application(uuid, text) to service_role;
