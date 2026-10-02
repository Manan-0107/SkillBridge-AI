-- ==============================================================================
-- Supabase Database-Level Test Suite: Authoritative RLS & Cross-User Isolation
-- ==============================================================================
-- Framework: pgTAP
-- Target File: supabase/tests/rls_authoritative_isolation.test.sql
-- ==============================================================================

begin;
select plan(38);

-- ─── SETUP: Test Identities and Context Helpers ──────────────────────────────
create or replace function tests.setup_test_environment()
returns void
language plpgsql
as $$
declare
  v_user_a_auth uuid := '11111111-1111-1111-1111-111111111111';
  v_user_b_auth uuid := '22222222-2222-2222-2222-222222222222';
  v_user_a_app  uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_user_b_app  uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
begin
  -- Seed auth.users if not present
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (v_user_a_auth, 'test_user_a@careerforge.test', '{"name": "User A"}'::jsonb),
    (v_user_b_auth, 'test_user_b@careerforge.test', '{"name": "User B"}'::jsonb)
  on conflict (id) do nothing;

  -- Seed public.users
  insert into public.users (id, auth_user_id, email, name)
  values
    (v_user_a_app, v_user_a_auth, 'test_user_a@careerforge.test', 'User A'),
    (v_user_b_app, v_user_b_auth, 'test_user_b@careerforge.test', 'User B')
  on conflict (id) do nothing;

  -- Seed User B record to test User A isolation against B
  insert into public.resume_uploads (id, user_id, filename, resume_text, target_role)
  values ('b1111111-1111-1111-1111-111111111111', v_user_b_app, 'user_b_resume.pdf', 'Resume B', 'Frontend')
  on conflict (id) do nothing;

  insert into public.practice_history (id, user_id, track, question_id, score)
  values ('b2222222-2222-2222-2222-222222222222', v_user_b_app, 'react', 'q1', 10)
  on conflict (id) do nothing;

  insert into public.roadmaps (id, user_id, role_id, title)
  values ('b3333333-3333-3333-3333-333333333333', v_user_b_app, 'frontend', 'Frontend Roadmap B')
  on conflict (id) do nothing;

  insert into public.telemetry_events (id, event_id, user_id, event_type)
  values ('b4444444-4444-4444-4444-444444444444', 'evt_b_init', v_user_b_app, 'login')
  on conflict (id) do nothing;
end;
$$;

select tests.setup_test_environment();

-- Helper: Simulate Authenticated JWT Session
create or replace function tests.authenticate_as(user_auth_id uuid, user_email text)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_auth_id::text, 'email', user_email)::text, true);
end;
$$;

create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

-- ─── TEST GROUP A: IDENTITY MAPPING & IMMUTABILITY ───────────────────────────
-- 1. All public users have non-null auth_user_id
select is_empty(
  'select id from public.users where auth_user_id is null',
  'Group A1: Every public.users record has a non-null auth_user_id'
);

-- 2. Foreign-key integrity: every auth_user_id exists in auth.users
select is_empty(
  'select pu.id from public.users pu where not exists (select 1 from auth.users au where au.id = pu.auth_user_id)',
  'Group A2: Every auth_user_id exists in auth.users'
);

-- 3. 1:1 uniqueness
select is(
  (select count(*)::int from public.users),
  (select count(distinct auth_user_id)::int from public.users),
  'Group A3: auth_user_id is strictly unique across public.users'
);

-- 4. Identity immutability: trigger blocks reassigning auth_user_id
select throws_ok(
  $$update public.users set auth_user_id = '99999999-9999-9999-9999-999999999999' where email = 'test_user_a@careerforge.test'$$,
  'Cannot mutate public.users.auth_user_id',
  'Group A4: Database trigger prevents mutating public.users.auth_user_id'
);

-- 5. Identity immutability: trigger blocks reassigning public.users.id
select throws_ok(
  $$update public.users set id = '99999999-9999-9999-9999-999999999999' where email = 'test_user_a@careerforge.test'$$,
  'Cannot mutate public.users.id',
  'Group A5: Database trigger prevents mutating public.users.id'
);

-- ─── TEST GROUP B: USER A AUTHORIZED OPERATIONS ──────────────────────────────
select tests.authenticate_as('11111111-1111-1111-1111-111111111111', 'test_user_a@careerforge.test');

-- 6. User A can read own profile
select results_eq(
  'select email from public.users where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  array['test_user_a@careerforge.test'],
  'Group B1: User A can read own user row'
);

-- 7. User A can insert own resume
insert into public.resume_uploads (id, user_id, filename, resume_text, target_role)
values ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user_a_resume.pdf', 'Resume A', 'Backend');

select results_eq(
  'select filename from public.resume_uploads where id = ''a1111111-1111-1111-1111-111111111111''',
  array['user_a_resume.pdf'],
  'Group B2: User A can insert and read own resume'
);

-- 8. User A can update own resume
update public.resume_uploads
set target_role = 'Fullstack'
where id = 'a1111111-1111-1111-1111-111111111111';

select results_eq(
  'select target_role from public.resume_uploads where id = ''a1111111-1111-1111-1111-111111111111''',
  array['Fullstack'],
  'Group B3: User A can update own resume'
);

-- 9. User A can insert and read practice history
insert into public.practice_history (id, user_id, track, question_id, score)
values ('a2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'node', 'q1', 10);

select results_eq(
  'select track from public.practice_history where id = ''a2222222-2222-2222-2222-222222222222''',
  array['node'],
  'Group B4: User A can insert and read own practice history'
);

-- 10. User A can insert and read roadmap
insert into public.roadmaps (id, user_id, role_id, title)
values ('a3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'backend', 'Backend Roadmap A');

select results_eq(
  'select title from public.roadmaps where id = ''a3333333-3333-3333-3333-333333333333''',
  array['Backend Roadmap A'],
  'Group B5: User A can insert and read own roadmap'
);

-- 11. User A can insert telemetry
insert into public.telemetry_events (id, event_id, user_id, event_type)
values ('a4444444-4444-4444-4444-444444444444', 'evt_a_1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'practice_submit');

select results_eq(
  'select event_type from public.telemetry_events where id = ''a4444444-4444-4444-4444-444444444444''',
  array['practice_submit'],
  'Group B6: User A can insert own telemetry'
);

-- ─── TEST GROUP C: USER A AGAINST USER B ISOLATION ───────────────────────────
-- User A context active
-- 12. User A CANNOT read User B's profile
select is_empty(
  'select id from public.users where id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''',
  'Group C1: User A cannot read User B profile'
);

-- 13. User A CANNOT read User B's resume
select is_empty(
  'select id from public.resume_uploads where user_id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''',
  'Group C2: User A cannot read User B resume'
);

-- 14. User A CANNOT update User B's resume
update public.resume_uploads
set resume_text = 'HACKED BY A'
where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select results_eq(
  'select resume_text from public.resume_uploads where id = ''b1111111-1111-1111-1111-111111111111''',
  array['Resume B'],
  'Group C3: User A cannot update User B resume'
);

-- 15. User A CANNOT delete User B's resume
delete from public.resume_uploads where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select is(
  (select count(*)::int from public.resume_uploads where id = 'b1111111-1111-1111-1111-111111111111'),
  1,
  'Group C4: User A cannot delete User B resume'
);

-- 16. User A CANNOT insert a resume owned by User B
select throws_ok(
  $$insert into public.resume_uploads (id, user_id, filename, resume_text, target_role)
    values ('a_spoof_b_resume', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'fake.pdf', 'text', 'role')$$,
  'new row violates row-level security policy for table "resume_uploads"',
  'Group C5: User A cannot insert resume owned by User B'
);

-- 17. User A CANNOT read User B's practice history
select is_empty(
  'select id from public.practice_history where user_id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''',
  'Group C6: User A cannot read User B practice history'
);

-- 18. User A CANNOT update User B's practice history
update public.practice_history set score = 0 where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select results_eq(
  'select score from public.practice_history where id = ''b2222222-2222-2222-2222-222222222222''',
  array[10],
  'Group C7: User A cannot update User B practice history'
);

-- 19. User A CANNOT read User B's roadmap
select is_empty(
  'select id from public.roadmaps where user_id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''',
  'Group C8: User A cannot read User B roadmap'
);

-- 20. User A CANNOT insert telemetry as User B
select throws_ok(
  $$insert into public.telemetry_events (id, event_id, user_id, event_type)
    values ('a_spoof_b_evt', 'evt_spoof', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'hack')$$,
  'new row violates row-level security policy for table "telemetry_events"',
  'Group C9: User A cannot insert telemetry as User B'
);

-- ─── TEST GROUP D: USER B ISOLATION IN REVERSE ───────────────────────────────
select tests.authenticate_as('22222222-2222-2222-2222-222222222222', 'test_user_b@careerforge.test');

-- 21. User B can read own profile
select results_eq(
  'select email from public.users where id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''',
  array['test_user_b@careerforge.test'],
  'Group D1: User B can read own user profile'
);

-- 22. User B CANNOT read User A's profile
select is_empty(
  'select id from public.users where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  'Group D2: User B cannot read User A profile'
);

-- 23. User B CANNOT read User A's resume
select is_empty(
  'select id from public.resume_uploads where user_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  'Group D3: User B cannot read User A resume'
);

-- 24. User B CANNOT update User A's resume
update public.resume_uploads set target_role = 'HACKED' where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select results_eq(
  'select target_role from public.resume_uploads where id = ''a1111111-1111-1111-1111-111111111111''',
  array['Fullstack'],
  'Group D4: User B cannot update User A resume'
);

-- 25. User B CANNOT delete User A's resume
delete from public.resume_uploads where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
  (select count(*)::int from public.resume_uploads where id = 'a1111111-1111-1111-1111-111111111111'),
  1,
  'Group D5: User B cannot delete User A resume'
);

-- ─── TEST GROUP E: ANONYMOUS USERS ───────────────────────────────────────────
select tests.authenticate_as_anon();

-- 26. Anonymous cannot read public.users
select is_empty('select id from public.users', 'Group E1: Anonymous cannot read public.users');

-- 27. Anonymous cannot read resume_uploads
select is_empty('select id from public.resume_uploads', 'Group E2: Anonymous cannot read resume_uploads');

-- 28. Anonymous cannot read practice_history
select is_empty('select id from public.practice_history', 'Group E3: Anonymous cannot read practice_history');

-- 29. Anonymous cannot read roadmaps
select is_empty('select id from public.roadmaps', 'Group E4: Anonymous cannot read roadmaps');

-- 30. Anonymous cannot read telemetry_events
select is_empty('select id from public.telemetry_events', 'Group E5: Anonymous cannot read telemetry_events');

-- 31. Anonymous cannot insert into users
select throws_ok(
  $$insert into public.users (email) values ('anon_hacker@evil.com')$$,
  'new row violates row-level security policy for table "users"',
  'Group E6: Anonymous cannot insert into public.users'
);

-- ─── TEST GROUP F: RAG DOMAIN KNOWLEDGE ACCESS ───────────────────────────────
-- Anonymous can read domain knowledge
-- 32. Anonymous can SELECT course_embeddings
select is_empty(
  'select id from public.course_embeddings where id = ''non_existent_check''',
  'Group F1: Anonymous has SELECT permission on course_embeddings'
);

-- 33. Anonymous CANNOT insert into course_embeddings
select throws_ok(
  $$insert into public.course_embeddings (id, title, content) values ('fake_course', 'Fake', 'Content')$$,
  'new row violates row-level security policy for table "course_embeddings"',
  'Group F2: Anonymous CANNOT insert into course_embeddings'
);

-- 34. Anonymous CANNOT update course_embeddings
select throws_ok(
  $$update public.course_embeddings set title = 'Hacked' where id = 'course-1'$$,
  'permission denied for table course_embeddings',
  'Group F3: Anonymous CANNOT update course_embeddings (explicit privilege denied)'
);

-- 35. Anonymous CANNOT delete course_embeddings
select throws_ok(
  $$delete from public.course_embeddings where id = 'course-1'$$,
  'permission denied for table course_embeddings',
  'Group F4: Anonymous CANNOT delete course_embeddings (explicit privilege denied)'
);

-- ─── TEST GROUP G: FUNCTION PRIVILEGE HARDENING ──────────────────────────────
-- 36. Anonymous CANNOT execute private.is_owner()
select throws_ok(
  $$select private.is_owner('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'permission denied for schema private',
  'Group G1: Anonymous cannot access schema private or execute private.is_owner'
);

-- 37. Authenticated CAN execute private.is_owner() via RLS evaluation
select tests.authenticate_as('11111111-1111-1111-1111-111111111111', 'test_user_a@careerforge.test');
select is(
  private.is_owner('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  true,
  'Group G2: Authenticated User A evaluates private.is_owner(own_id) as true'
);

-- 38. Authenticated User A evaluates private.is_owner(user_b_id) as false
select is(
  private.is_owner('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  false,
  'Group G3: Authenticated User A evaluates private.is_owner(user_b_id) as false'
);

select * from finish();
rollback;
