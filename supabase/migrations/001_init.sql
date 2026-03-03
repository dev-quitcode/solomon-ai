-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('admin', 'user')),
  full_name text,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, role, full_name)
  values (new.id, 'user', new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PROJECTS
-- ============================================================
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  client_name text,
  industry text,
  type text not null default 'greenfield' check (type in ('greenfield', 'brownfield')),
  mode text not null default 'epics_and_stories' check (mode in ('epics_and_stories', 'stories_only')),
  status text not null default 'setup' check (status in ('setup', 'sources', 'charter', 'prd', 'epics', 'stories', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ============================================================
-- DATA SOURCES
-- ============================================================
create table public.data_sources (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'text', 'pdf', 'json_schema', 'website', 'questionnaire',
    'job_description_initial', 'job_description_detailed',
    'call_transcript', 'domain_knowledge'
  )),
  title text not null,
  content text,
  file_path text,
  metadata jsonb not null default '{}',
  status text not null default 'processing' check (status in ('processing', 'ready', 'error')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- PROJECT CHARTER
-- ============================================================
create table public.project_charter (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sponsor text,
  budget text,
  start_date text,
  approximate_duration text,
  high_level_timeline text,
  goals text,
  business_case text,
  major_risks text,
  difficulties text,
  success_criteria text,
  qc_goal text,
  participants jsonb not null default '[]',
  stakeholders jsonb not null default '[]',
  communication text,
  website text,
  content text,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger charter_updated_at
  before update on public.project_charter
  for each row execute function public.touch_updated_at();

-- ============================================================
-- PRD
-- ============================================================
create table public.prd (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  business_case text,
  success_metrics text,
  pain_points text,
  goals text,
  potential_solutions text,
  business_context text,
  kpis text,
  definition_of_success text,
  current_state jsonb,
  users_and_stakeholders jsonb,
  desired_future_state jsonb,
  technical_constraints text,
  content text,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger prd_updated_at
  before update on public.prd
  for each row execute function public.touch_updated_at();

-- ============================================================
-- EPICS
-- ============================================================
create table public.epics (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  prd_id uuid references public.prd(id) on delete set null,
  code text not null,
  title text not null,
  description text,
  acceptance_criteria text,
  priority text not null default 'should' check (priority in ('must', 'should', 'could', 'wont')),
  "order" integer not null default 0,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger epics_updated_at
  before update on public.epics
  for each row execute function public.touch_updated_at();

-- ============================================================
-- USER STORIES
-- ============================================================
create table public.user_stories (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  epic_id uuid references public.epics(id) on delete set null,
  code text not null,
  title text not null,
  as_a text not null default '',
  i_want text not null default '',
  so_that text not null default '',
  acceptance_criteria text[] not null default '{}',
  priority text not null default 'should' check (priority in ('must', 'should', 'could', 'wont')),
  effort_estimate text check (effort_estimate in ('S', 'M', 'L', 'XL')),
  "order" integer not null default 0,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger stories_updated_at
  before update on public.user_stories
  for each row execute function public.touch_updated_at();

-- ============================================================
-- SYSTEM PROMPTS (admin-managed)
-- ============================================================
create table public.system_prompts (
  id uuid primary key default uuid_generate_v4(),
  stage text not null unique check (stage in ('charter', 'prd', 'epics', 'stories', 'domain_research')),
  content text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Seed default system prompts
insert into public.system_prompts (stage, content) values
  ('charter', 'You are a senior Business Analyst and Project Manager. Generate a formal Project Charter based on the provided project information and source documents. Structure it clearly with all key sections: objectives, scope, stakeholders, risks, timeline, and success criteria.'),
  ('prd', 'You are a senior Product Manager and Business Analyst. Generate a comprehensive Product Requirements Document (PRD) based on the Project Charter and source documents. Follow BABOK best practices. Ensure all requirements are SMART (Specific, Measurable, Achievable, Relevant, Time-bound).'),
  ('epics', 'You are a senior Product Manager. Based on the PRD, generate high-level Epics that group related requirements into logical feature areas. Each Epic should have a clear scope boundary, description, and acceptance criteria.'),
  ('stories', 'You are a senior Business Analyst. Generate User Stories in the standard format (As a [role], I want [feature], so that [benefit]) with clear, testable acceptance criteria. Stories should be independent and small enough to complete in one sprint.'),
  ('domain_research', 'You are a domain research specialist. Analyze the provided industry and project context, then synthesize research findings into a structured domain knowledge summary covering: market overview, key players, common challenges, relevant regulations, and technology trends.');

-- ============================================================
-- PROJECT PROMPTS (per-project overrides)
-- ============================================================
create table public.project_prompts (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  stage text not null check (stage in ('charter', 'prd', 'epics', 'stories', 'domain_research')),
  content text not null,
  updated_at timestamptz not null default now(),
  unique(project_id, stage)
);

-- ============================================================
-- USER SETTINGS
-- ============================================================
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  anthropic_api_key text,
  tavily_api_key text,
  model text not null default 'claude-sonnet-4-6',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.data_sources enable row level security;
alter table public.project_charter enable row level security;
alter table public.prd enable row level security;
alter table public.epics enable row level security;
alter table public.user_stories enable row level security;
alter table public.system_prompts enable row level security;
alter table public.project_prompts enable row level security;
alter table public.user_settings enable row level security;

-- Profiles: users see own, admins see all
create policy "users_own_profile" on public.profiles
  for all using (auth.uid() = user_id);

create policy "admins_all_profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin')
  );

-- Projects: users own their projects, admins see all
create policy "users_own_projects" on public.projects
  for all using (auth.uid() = user_id);

create policy "admins_all_projects" on public.projects
  for select using (
    exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin')
  );

-- Data sources: access via project ownership
create policy "users_own_sources" on public.data_sources
  for all using (auth.uid() = user_id);

-- Charter: access via project ownership
create policy "users_own_charter" on public.project_charter
  for all using (
    exists (select 1 from public.projects where id = project_id and user_id = auth.uid())
  );

-- PRD: access via project ownership
create policy "users_own_prd" on public.prd
  for all using (
    exists (select 1 from public.projects where id = project_id and user_id = auth.uid())
  );

-- Epics: access via project ownership
create policy "users_own_epics" on public.epics
  for all using (
    exists (select 1 from public.projects where id = project_id and user_id = auth.uid())
  );

-- User stories: access via project ownership
create policy "users_own_stories" on public.user_stories
  for all using (
    exists (select 1 from public.projects where id = project_id and user_id = auth.uid())
  );

-- System prompts: everyone reads, only admins write
create policy "everyone_reads_system_prompts" on public.system_prompts
  for select using (true);

create policy "admins_write_system_prompts" on public.system_prompts
  for all using (
    exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin')
  );

-- Project prompts: access via project ownership
create policy "users_own_project_prompts" on public.project_prompts
  for all using (
    exists (select 1 from public.projects where id = project_id and user_id = auth.uid())
  );

-- User settings: own only
create policy "users_own_settings" on public.user_settings
  for all using (auth.uid() = user_id);
