-- supabase/migrations/007_github_integration.sql
-- Add GitHub connection fields to profiles
alter table public.profiles
  add column if not exists github_access_token text,
  add column if not exists github_username      text,
  add column if not exists github_connected_at  timestamptz;

-- Add GitHub export tracking to projects
alter table public.projects
  add column if not exists github_repo_url    text,
  add column if not exists github_exported_at timestamptz,
  add column if not exists github_sync_error  text;

-- Add GitHub reference to epics
alter table public.epics
  add column if not exists github_milestone_number integer;

-- Add GitHub reference to user_stories
alter table public.user_stories
  add column if not exists github_issue_number integer;

-- Add GitHub file SHA to prd (needed by GitHub Contents API to update a file)
alter table public.prd
  add column if not exists github_file_sha text;
