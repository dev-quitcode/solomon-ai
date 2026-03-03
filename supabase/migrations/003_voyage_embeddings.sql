-- Update embedding column to 1024 dims (voyage-3 model)
-- Safe to drop/recreate since no embeddings have been generated yet
alter table public.data_sources drop column if exists embedding;
alter table public.data_sources add column embedding vector(1024);

-- Recreate index for new dimension
drop index if exists data_sources_embedding_idx;
create index data_sources_embedding_idx
  on public.data_sources
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Update match_sources function to use 1024 dims
create or replace function match_sources(
  query_embedding vector(1024),
  project_id_filter uuid,
  match_count int default 5,
  enabled_only bool default true
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
    and (not enabled_only or enabled = true)
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Add voyage_api_key to user_settings
alter table public.user_settings
  add column if not exists voyage_api_key text;

-- Stored generated column: true when embedding exists, false otherwise
-- Lets us query embedding status without sending the full vector over the wire
alter table public.data_sources
  add column if not exists has_embedding boolean generated always as (embedding is not null) stored;
