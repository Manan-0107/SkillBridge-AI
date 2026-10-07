-- ==============================================================================
-- Supabase Migration: Ephemeral Stores Persistence & Multi-Tenant Isolation
-- ==============================================================================
-- Migration Date: 2026-10-07
-- Scope:
-- 1. Create public.career_memory for personal career memory with strict provenance
-- 2. Create public.skill_evidence for verifiable multi-source skill evidence wallet
-- 3. Create public.automation_executions for 3-tier automation engine execution logs
-- 4. Enable Row-Level Security (RLS) on all tables with private.is_owner()
-- 5. Foreign keys cascade with public.users(id)
-- 6. Add high-performance indexes for user_id and lookup fields
-- ==============================================================================

-- ─── 1. Career Memory Table ───────────────────────────────────────────────────
create table if not exists public.career_memory (
  id                  text primary key,
  user_id             uuid not null references public.users(id) on delete cascade,
  category            text not null, -- CAREER_GOAL, CORE_SKILL, WORK_PREFERENCE, EXPERIENCE, CONSTRAINT, ACHIEVEMENT, EDUCATION
  key                 text not null,
  value               text not null,
  provenance          text not null default 'INFERRED', -- CONFIRMED, INFERRED, UNKNOWN, OUTDATED, USER_REJECTED
  confidence          numeric not null default 0.8,
  source_description  text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  confirmed_at        timestamptz,
  rejected_reason     text
);

create index if not exists idx_career_memory_user_id on public.career_memory(user_id);
create index if not exists idx_career_memory_user_cat on public.career_memory(user_id, category);

alter table public.career_memory enable row level security;

create policy "Users can select own career memory" on public.career_memory
  for select using (private.is_owner(user_id));

create policy "Users can insert own career memory" on public.career_memory
  for insert with check (private.is_owner(user_id));

create policy "Users can update own career memory" on public.career_memory
  for update using (private.is_owner(user_id)) with check (private.is_owner(user_id));

create policy "Users can delete own career memory" on public.career_memory
  for delete using (private.is_owner(user_id));

grant select, insert, update, delete on public.career_memory to authenticated, service_role;

-- ─── 2. Skill Evidence Table ──────────────────────────────────────────────────
create table if not exists public.skill_evidence (
  id                    text primary key,
  user_id               uuid not null references public.users(id) on delete cascade,
  skill_id              text not null,
  skill_name            text not null,
  source                text not null default 'USER_CONFIRMATION',
  status                text not null default 'INFERRED', -- CONFIRMED, INFERRED, UNKNOWN, OUTDATED, USER_REJECTED
  confidence            numeric not null default 0.5,
  title                 text not null default '',
  description           text not null default '',
  artifact_url          text,
  created_at            timestamptz not null default now(),
  verified_at           timestamptz,
  rejection_reason      text,
  provenance            text default 'INFERRED',
  verification_metadata jsonb default '{}'::jsonb
);

create index if not exists idx_skill_evidence_user_id on public.skill_evidence(user_id);
create index if not exists idx_skill_evidence_user_skill on public.skill_evidence(user_id, skill_id);

alter table public.skill_evidence enable row level security;

create policy "Users can select own skill evidence" on public.skill_evidence
  for select using (private.is_owner(user_id));

create policy "Users can insert own skill evidence" on public.skill_evidence
  for insert with check (private.is_owner(user_id));

create policy "Users can update own skill evidence" on public.skill_evidence
  for update using (private.is_owner(user_id)) with check (private.is_owner(user_id));

create policy "Users can delete own skill evidence" on public.skill_evidence
  for delete using (private.is_owner(user_id));

grant select, insert, update, delete on public.skill_evidence to authenticated, service_role;

-- ─── 3. Automation Executions Table ───────────────────────────────────────────
create table if not exists public.automation_executions (
  id                    text primary key,
  user_id               uuid not null references public.users(id) on delete cascade,
  automation_id         text not null,
  action_class          text not null default 'SAFE_AUTOMATIC', -- SAFE_AUTOMATIC, CONFIRMATION_REQUIRED, EXPLICIT_HUMAN_ACTION
  state                 text not null default 'PENDING', -- PENDING, WAITING_FOR_CONFIRMATION, RUNNING, COMPLETED, FAILED, CANCELLED
  trigger               jsonb not null default '{}'::jsonb,
  planned_actions       jsonb not null default '[]'::jsonb,
  executed_actions      jsonb not null default '[]'::jsonb,
  confirmation_token    text,
  confirmation_expiry   timestamptz,
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  error                 text,
  result                jsonb,
  provenance            text not null default 'SYSTEM_AUTONOMOUS' -- SYSTEM_AUTONOMOUS, USER_CONFIRMED
);

create index if not exists idx_automation_executions_user_id on public.automation_executions(user_id);
create index if not exists idx_automation_executions_user_auto on public.automation_executions(user_id, automation_id);

alter table public.automation_executions enable row level security;

create policy "Users can select own automation executions" on public.automation_executions
  for select using (private.is_owner(user_id));

create policy "Users can insert own automation executions" on public.automation_executions
  for insert with check (private.is_owner(user_id));

create policy "Users can update own automation executions" on public.automation_executions
  for update using (private.is_owner(user_id)) with check (private.is_owner(user_id));

create policy "Users can delete own automation executions" on public.automation_executions
  for delete using (private.is_owner(user_id));

grant select, insert, update, delete on public.automation_executions to authenticated, service_role;
