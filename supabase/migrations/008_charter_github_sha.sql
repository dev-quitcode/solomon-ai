-- supabase/migrations/008_charter_github_sha.sql
-- Add GitHub file SHA to project_charter (needed by GitHub Contents API to update a file)
alter table public.project_charter
  add column if not exists github_file_sha text;
