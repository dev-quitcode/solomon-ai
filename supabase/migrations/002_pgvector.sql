-- Enable pgvector extension
create extension if not exists vector;

-- Add embedding column to data_sources
-- text-embedding-3-small produces 1536-dimensional vectors
alter table public.data_sources
  add column if not exists embedding vector(1536);

-- Index for fast similarity search
create index if not exists data_sources_embedding_idx
  on public.data_sources
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Helper function: find similar sources for a project
create or replace function match_sources(
  query_embedding vector(1536),
  project_id_filter uuid,
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  content text,
  type text,
  similarity float
)
language sql stable
as $$
  select
    id,
    title,
    content,
    type,
    1 - (embedding <=> query_embedding) as similarity
  from public.data_sources
  where
    project_id = project_id_filter
    and status = 'ready'
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
