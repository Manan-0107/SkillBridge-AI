-- ============================================================================
-- Supabase Postgres Schema: Scoped RAG Vector Storage & Similarity Functions
-- Enables pgvector extension and sets up domain-specific collections:
-- 1. Courses
-- 2. Roadmap content
-- 3. Resume/ATS heuristics
-- 4. Job listings (Local/internships)
-- ============================================================================

-- 0. Enable pgvector extension
create extension if not exists vector;

-- 1. Course Embeddings
create table if not exists course_embeddings (
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

create index if not exists idx_course_embeddings_vector 
  on course_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 2. Roadmap Node Embeddings
create table if not exists roadmap_nodes (
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

create index if not exists idx_roadmap_nodes_vector 
  on roadmap_nodes using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 3. Resume/ATS Heuristics Embeddings
create table if not exists resume_heuristic_embeddings (
  id text primary key,
  category text not null,
  rule_title text not null,
  guidance text not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

create index if not exists idx_resume_heuristics_vector 
  on resume_heuristic_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 4. Job Listings Embeddings
create table if not exists job_embeddings (
  id text primary key,
  title text not null,
  company text not null,
  location text,
  work_arrangement text,
  tags text[],
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

create index if not exists idx_job_embeddings_vector 
  on job_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================================================
-- Similarity Search RPC Functions (Cosine Distance: 1 - (embedding <=> query))
-- ============================================================================

create or replace function match_courses(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id text,
  title text,
  role text,
  provider text,
  level text,
  content text,
  similarity float
)
language plpgsql as $$
begin
  return query
  select 
    c.id, 
    c.title, 
    c.role, 
    c.provider, 
    c.level, 
    c.content, 
    1 - (c.embedding <=> query_embedding) as similarity
  from course_embeddings c
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

create or replace function match_roadmap(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id text,
  role text,
  title text,
  detail text,
  content text,
  similarity float
)
language plpgsql as $$
begin
  return query
  select 
    r.id, 
    r.role, 
    r.title, 
    r.detail, 
    r.content, 
    1 - (r.embedding <=> query_embedding) as similarity
  from roadmap_nodes r
  where r.embedding is not null
  order by r.embedding <=> query_embedding
  limit match_count;
end;
$$;

create or replace function match_resume_heuristics(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id text,
  category text,
  rule_title text,
  guidance text,
  content text,
  similarity float
)
language plpgsql as $$
begin
  return query
  select 
    h.id, 
    h.category, 
    h.rule_title, 
    h.guidance, 
    h.content, 
    1 - (h.embedding <=> query_embedding) as similarity
  from resume_heuristic_embeddings h
  where h.embedding is not null
  order by h.embedding <=> query_embedding
  limit match_count;
end;
$$;

create or replace function match_jobs(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id text,
  title text,
  company text,
  location text,
  content text,
  similarity float
)
language plpgsql as $$
begin
  return query
  select 
    j.id, 
    j.title, 
    j.company, 
    j.location, 
    j.content, 
    1 - (j.embedding <=> query_embedding) as similarity
  from job_embeddings j
  where j.embedding is not null
  order by j.embedding <=> query_embedding
  limit match_count;
end;
$$;
