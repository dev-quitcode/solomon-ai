# CEO Control Panel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Next.js + Supabase app for a CEO and assistant to manage strategic goal hierarchies with check-ins, corrections, and notes.

**Architecture:** New Next.js 15 App Router project with Supabase for auth + Postgres. A single canvas page renders all top-level goals as side-by-side downward trees connected by SVG lines. Clicking any node slides in a right-side detail panel with history, corrections, and notes.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase (Postgres + RLS + Auth), Vitest

**Spec:** `docs/superpowers/specs/2026-04-02-ceo-control-panel-design.md` in the Solomon repo (for reference only — implementation is a new standalone project)

---

## Chunk 1: Scaffold + Database + Auth

### Task 1: Scaffold the project

**Files:**
- Create: `ceo-control-panel/` (new repo, sibling to Solomon — e.g. `~/Documents/Claude/ceo-control-panel`)

- [ ] **Step 1: Create the Next.js app**

```bash
cd ~/Documents/Claude
npx create-next-app@latest ceo-control-panel \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
cd ceo-control-panel
```

- [ ] **Step 2: Add Vitest**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 4: Create `src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to `package.json`**

In `package.json`, add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Add Supabase packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 7: Create `.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

- [ ] **Step 8: Verify scaffold**

```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 9: Init git and commit**

```bash
git init
echo ".env.local" >> .gitignore
git add -A
git commit -m "chore: scaffold Next.js project with Vitest and Supabase"
```

---

### Task 2: Database schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create the migrations directory**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/001_initial_schema.sql

-- Profiles (extends Supabase auth.users)
create type user_role as enum ('ceo', 'assistant');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  display_name text not null
);

-- Status enum
create type node_status as enum ('green', 'yellow', 'red', 'gray');

-- Correction type enum
create type correction_type as enum ('scope', 'timeline', 'resource', 'other');

-- Correction status enum
create type correction_status as enum ('open', 'resolved');

-- Readable ID sequences (one row per level)
create table readable_id_sequences (
  level int primary key check (level between 1 and 4),
  next_val int not null default 1
);
insert into readable_id_sequences (level, next_val) values (1,1),(2,1),(3,1),(4,1);

-- Goals (all hierarchy levels)
create table goals (
  id uuid primary key default gen_random_uuid(),
  readable_id text not null unique,
  level int not null check (level between 1 and 4),
  title text not null,
  owner text not null default '',
  metric_target text not null default '',
  metric_current text not null default '',
  status node_status not null default 'gray',
  next_review_at date,
  parent_id uuid references goals(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Check-ins
create table check_ins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  status node_status not null,
  metric_current text not null default '',
  note text not null default '',
  next_review_at date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Corrections
create table corrections (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  type correction_type not null,
  description text not null,
  due_date date,
  responsible text not null default '',
  status correction_status not null default 'open',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Notes
create table notes (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  body text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Hierarchy config
create table hierarchy_config (
  level int primary key check (level between 1 and 4),
  label text not null
);
insert into hierarchy_config (level, label) values
  (1, 'Company Goal'),
  (2, 'Initiative'),
  (3, 'Team Priority'),
  (4, 'Commitment');

-- =====================
-- ROW LEVEL SECURITY
-- =====================

alter table profiles enable row level security;
alter table goals enable row level security;
alter table check_ins enable row level security;
alter table corrections enable row level security;
alter table notes enable row level security;
alter table hierarchy_config enable row level security;
alter table readable_id_sequences enable row level security;

-- Helper: get current user's role
create or replace function get_my_role()
returns user_role
language sql
security definer
as $$
  select role from profiles where id = auth.uid()
$$;

-- profiles: anyone can read their own; no self-edit needed
create policy "profiles_select" on profiles for select using (true);

-- goals: both roles read; only assistant writes
create policy "goals_select" on goals for select using (true);
create policy "goals_insert" on goals for insert with check (get_my_role() = 'assistant');
create policy "goals_update" on goals for update using (get_my_role() = 'assistant');
create policy "goals_delete" on goals for delete using (get_my_role() = 'assistant');

-- check_ins: both roles read; only assistant inserts
create policy "checkins_select" on check_ins for select using (true);
create policy "checkins_insert" on check_ins for insert with check (get_my_role() = 'assistant');

-- corrections: both roles read; only assistant writes
create policy "corrections_select" on corrections for select using (true);
create policy "corrections_insert" on corrections for insert with check (get_my_role() = 'assistant');
create policy "corrections_update" on corrections for update using (get_my_role() = 'assistant');

-- notes: both roles read and insert
create policy "notes_select" on notes for select using (true);
create policy "notes_insert" on notes for insert with check (auth.uid() is not null);

-- hierarchy_config: both roles read; only assistant updates
create policy "hierarchy_select" on hierarchy_config for select using (true);
create policy "hierarchy_update" on hierarchy_config for update using (get_my_role() = 'assistant');

-- readable_id_sequences: only assistant can update (increment)
create policy "sequences_select" on readable_id_sequences for select using (true);
create policy "sequences_update" on readable_id_sequences for update using (get_my_role() = 'assistant');

-- =====================
-- updated_at trigger
-- =====================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger goals_updated_at
  before update on goals
  for each row execute function set_updated_at();
```

- [ ] **Step 3: Apply the migration**

In the Supabase dashboard for your new project, go to **SQL Editor** and paste + run the entire file above.

- [ ] **Step 4: Create two users in Supabase Auth**

In Supabase dashboard → Authentication → Users → "Add user":
1. CEO user: `ceo@yourdomain.com` with a strong password
2. Assistant user: `assistant@yourdomain.com` with a strong password

Then in SQL Editor, insert their profiles (replace the UUIDs with the actual user IDs from the Auth table):
```sql
insert into profiles (id, role, display_name) values
  ('<ceo-user-uuid>', 'ceo', 'CEO'),
  ('<assistant-user-uuid>', 'assistant', 'Assistant');
```

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add initial database schema with RLS"
```

---

### Task 3: Supabase client + TypeScript types

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create browser client**

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server client**

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create TypeScript types**

```typescript
// src/lib/types.ts

export type UserRole = 'ceo' | 'assistant'
export type NodeStatus = 'green' | 'yellow' | 'red' | 'gray'
export type CorrectionType = 'scope' | 'timeline' | 'resource' | 'other'
export type CorrectionStatus = 'open' | 'resolved'

export interface Profile {
  id: string
  role: UserRole
  display_name: string
}

export interface Goal {
  id: string
  readable_id: string
  level: number
  title: string
  owner: string
  metric_target: string
  metric_current: string
  status: NodeStatus
  next_review_at: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface CheckIn {
  id: string
  goal_id: string
  status: NodeStatus
  metric_current: string
  note: string
  next_review_at: string | null
  created_by: string
  created_at: string
  profile?: { display_name: string }
}

export interface Correction {
  id: string
  goal_id: string
  type: CorrectionType
  description: string
  due_date: string | null
  responsible: string
  status: CorrectionStatus
  created_by: string
  created_at: string
}

export interface Note {
  id: string
  goal_id: string
  body: string
  created_by: string
  created_at: string
  profile?: { display_name: string }
}

export interface HierarchyConfig {
  level: number
  label: string
}
```

- [ ] **Step 4: Write tests for types (smoke test — ensure imports work)**

```typescript
// src/lib/__tests__/types.test.ts
import { describe, it, expect } from 'vitest'
import type { Goal, CheckIn, Correction, Note, HierarchyConfig } from '@/lib/types'

describe('types', () => {
  it('Goal type has required fields', () => {
    const goal: Goal = {
      id: 'uuid',
      readable_id: 'G-001',
      level: 1,
      title: 'Revenue 2026',
      owner: 'Sarah',
      metric_target: '$5M ARR',
      metric_current: '$2M ARR',
      status: 'green',
      next_review_at: null,
      parent_id: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    expect(goal.readable_id).toBe('G-001')
  })
})
```

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: 1 test passing.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: add Supabase clients and TypeScript types"
```

---

### Task 4: Auth — login page + middleware

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/middleware.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create middleware to protect routes**

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2: Create login page**

```typescript
// src/app/login/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Control Panel</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update root layout to be minimal**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Control Panel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Build to verify**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: add login page and auth middleware"
```

---

## Chunk 2: Readable ID + Goals API

### Task 5: Readable ID generation

**Files:**
- Create: `src/lib/readable-id.ts`
- Create: `src/lib/__tests__/readable-id.test.ts`

- [ ] **Step 1: Write failing tests first**

```typescript
// src/lib/__tests__/readable-id.test.ts
import { describe, it, expect } from 'vitest'
import { formatReadableId, levelPrefix } from '@/lib/readable-id'

describe('formatReadableId', () => {
  it('formats level 1 with G- prefix, zero-padded to 3 digits', () => {
    expect(formatReadableId(1, 1)).toBe('G-001')
    expect(formatReadableId(1, 42)).toBe('G-042')
    expect(formatReadableId(1, 100)).toBe('G-100')
    expect(formatReadableId(1, 1000)).toBe('G-1000') // no truncation over 999
  })

  it('formats level 2 with I- prefix', () => {
    expect(formatReadableId(2, 5)).toBe('I-005')
  })

  it('formats level 3 with T- prefix', () => {
    expect(formatReadableId(3, 7)).toBe('T-007')
  })

  it('formats level 4 with C- prefix', () => {
    expect(formatReadableId(4, 12)).toBe('C-012')
  })

  it('throws for invalid level', () => {
    expect(() => formatReadableId(5, 1)).toThrow()
    expect(() => formatReadableId(0, 1)).toThrow()
  })
})

describe('levelPrefix', () => {
  it('returns correct prefix for each level', () => {
    expect(levelPrefix(1)).toBe('G')
    expect(levelPrefix(2)).toBe('I')
    expect(levelPrefix(3)).toBe('T')
    expect(levelPrefix(4)).toBe('C')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test
```
Expected: FAIL — "Cannot find module '@/lib/readable-id'"

- [ ] **Step 3: Implement**

```typescript
// src/lib/readable-id.ts

const PREFIXES: Record<number, string> = { 1: 'G', 2: 'I', 3: 'T', 4: 'C' }

export function levelPrefix(level: number): string {
  const prefix = PREFIXES[level]
  if (!prefix) throw new Error(`Invalid level: ${level}. Must be 1–4.`)
  return prefix
}

export function formatReadableId(level: number, val: number): string {
  const prefix = levelPrefix(level)
  const padded = String(val).padStart(3, '0')
  return `${prefix}-${padded}`
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test
```
Expected: All tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/readable-id.ts src/lib/__tests__/readable-id.test.ts
git commit -m "feat: add readable ID formatting utility"
```

---

### Task 6: Goals API routes

**Files:**
- Create: `src/app/api/goals/route.ts`
- Create: `src/app/api/goals/[id]/route.ts`

- [ ] **Step 1: Create goals list + create route**

```typescript
// src/app/api/goals/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatReadableId } from '@/lib/readable-id'

// GET /api/goals — fetch all goals (flat list; client builds tree)
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/goals — create a new node
export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { title, owner, metric_target, status, next_review_at, parent_id, level } = body

  if (!title || !level) {
    return NextResponse.json({ error: 'title and level are required' }, { status: 400 })
  }

  // Atomically increment sequence and get next val
  const { data: seq, error: seqErr } = await supabase.rpc('next_readable_id', { p_level: level })
  if (seqErr) return NextResponse.json({ error: seqErr.message }, { status: 500 })

  const readable_id = formatReadableId(level, seq as number)

  const { data, error } = await supabase
    .from('goals')
    .insert({
      readable_id,
      level,
      title,
      owner: owner ?? '',
      metric_target: metric_target ?? '',
      metric_current: '',
      status: status ?? 'gray',
      next_review_at: next_review_at ?? null,
      parent_id: parent_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Add the `next_readable_id` Postgres function**

In Supabase SQL Editor, run:
```sql
create or replace function next_readable_id(p_level int)
returns int
language plpgsql
security definer
as $$
declare
  v_next int;
begin
  update readable_id_sequences
  set next_val = next_val + 1
  where level = p_level
  returning next_val - 1 into v_next;
  return v_next;
end;
$$;
```

This atomically increments and returns the previous value (the one to use).

- [ ] **Step 3: Create goal detail route (PATCH + DELETE)**

```typescript
// src/app/api/goals/[id]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/goals/:id — update goal fields
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()
  const allowed = ['title', 'owner', 'metric_target', 'metric_current', 'status', 'next_review_at']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/goals/:id
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 4: Build to verify**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/goals/
git commit -m "feat: add goals API routes (GET, POST, PATCH, DELETE)"
```

---

### Task 7: Check-ins, Corrections, Notes API routes

**Files:**
- Create: `src/app/api/goals/[id]/checkins/route.ts`
- Create: `src/app/api/goals/[id]/corrections/route.ts`
- Create: `src/app/api/goals/[id]/corrections/[cid]/route.ts`
- Create: `src/app/api/goals/[id]/notes/route.ts`
- Create: `src/app/api/hierarchy/route.ts`

- [ ] **Step 1: Check-ins route**

```typescript
// src/app/api/goals/[id]/checkins/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('check_ins')
    .select('*, profile:profiles(display_name)')
    .eq('goal_id', id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { status, metric_current, note, next_review_at } = body
  if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 })

  // Insert check-in
  const { data: checkIn, error: ciErr } = await supabase
    .from('check_ins')
    .insert({ goal_id: id, status, metric_current: metric_current ?? '', note: note ?? '', next_review_at: next_review_at ?? null, created_by: user.id })
    .select()
    .single()
  if (ciErr) return NextResponse.json({ error: ciErr.message }, { status: 500 })

  // Update parent goal (application-layer sync)
  const goalUpdates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (metric_current !== undefined) goalUpdates.metric_current = metric_current
  if (next_review_at !== undefined) goalUpdates.next_review_at = next_review_at

  await supabase.from('goals').update(goalUpdates).eq('id', id)

  return NextResponse.json(checkIn, { status: 201 })
}
```

- [ ] **Step 2: Corrections routes**

```typescript
// src/app/api/goals/[id]/corrections/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('corrections')
    .select('*')
    .eq('goal_id', id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type, description, due_date, responsible } = body
  if (!type || !description) {
    return NextResponse.json({ error: 'type and description are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('corrections')
    .insert({ goal_id: id, type, description, due_date: due_date ?? null, responsible: responsible ?? '', status: 'open', created_by: user.id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

```typescript
// src/app/api/goals/[id]/corrections/[cid]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/goals/:id/corrections/:cid — resolve a correction
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { cid } = await params
  const supabase = await createClient()
  const body = await request.json()
  const { status } = body
  if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('corrections')
    .update({ status })
    .eq('id', cid)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Notes route**

```typescript
// src/app/api/goals/[id]/notes/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('*, profile:profiles(display_name)')
    .eq('goal_id', id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.body) return NextResponse.json({ error: 'body is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('notes')
    .insert({ goal_id: id, body: body.body, created_by: user.id })
    .select('*, profile:profiles(display_name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 4: Hierarchy config route**

```typescript
// src/app/api/hierarchy/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hierarchy_config')
    .select('*')
    .order('level', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const body: Array<{ level: number; label: string }> = await request.json()
  const updates = body.map(({ level, label }) =>
    supabase.from('hierarchy_config').update({ label }).eq('level', level)
  )
  await Promise.all(updates)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Build to verify**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/
git commit -m "feat: add check-ins, corrections, notes, and hierarchy API routes"
```

---

## Chunk 3: Canvas UI

### Task 8: Node card component

**Files:**
- Create: `src/components/canvas/NodeCard.tsx`
- Create: `src/components/canvas/__tests__/NodeCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// src/components/canvas/__tests__/NodeCard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeCard } from '@/components/canvas/NodeCard'
import type { Goal } from '@/lib/types'

const baseGoal: Goal = {
  id: 'abc',
  readable_id: 'G-001',
  level: 1,
  title: 'Revenue 2026',
  owner: 'Sarah',
  metric_target: '$5M ARR',
  metric_current: '$2M ARR',
  status: 'green',
  next_review_at: null,
  parent_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('NodeCard', () => {
  it('renders readable_id and title', () => {
    render(<NodeCard goal={baseGoal} levelLabel="Company Goal" isSelected={false} onClick={() => {}} />)
    expect(screen.getByText('G-001')).toBeInTheDocument()
    expect(screen.getByText('Revenue 2026')).toBeInTheDocument()
  })

  it('renders owner and metrics', () => {
    render(<NodeCard goal={baseGoal} levelLabel="Company Goal" isSelected={false} onClick={() => {}} />)
    expect(screen.getByText('Sarah')).toBeInTheDocument()
    expect(screen.getByText('$2M ARR / $5M ARR')).toBeInTheDocument()
  })

  it('shows stale badge when updated_at is older than 7 days', () => {
    const staleGoal = { ...baseGoal, updated_at: '2025-01-01T00:00:00Z', status: 'green' as const }
    render(<NodeCard goal={staleGoal} levelLabel="Company Goal" isSelected={false} onClick={() => {}} />)
    expect(screen.getByText(/stale/i)).toBeInTheDocument()
  })

  it('does not show stale badge for gray status', () => {
    const grayGoal = { ...baseGoal, updated_at: '2025-01-01T00:00:00Z', status: 'gray' as const }
    render(<NodeCard goal={grayGoal} levelLabel="Company Goal" isSelected={false} onClick={() => {}} />)
    expect(screen.queryByText(/stale/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test
```
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement NodeCard**

```typescript
// src/components/canvas/NodeCard.tsx
import type { Goal, NodeStatus } from '@/lib/types'

const STATUS_COLORS: Record<NodeStatus, string> = {
  green: 'border-l-green-500',
  yellow: 'border-l-yellow-500',
  red: 'border-l-red-500',
  gray: 'border-l-gray-300',
}

const STATUS_DOTS: Record<NodeStatus, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  gray: 'bg-gray-300',
}

const LEVEL_SIZES: Record<number, string> = {
  1: 'min-w-[220px] max-w-[260px] p-3',
  2: 'min-w-[190px] max-w-[230px] p-2.5',
  3: 'min-w-[170px] max-w-[200px] p-2',
  4: 'min-w-[150px] max-w-[180px] p-2',
}

function isStale(goal: Goal): boolean {
  if (goal.status === 'gray') return false
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  return Date.now() - new Date(goal.updated_at).getTime() > sevenDaysMs
}

function isOverdue(goal: Goal): boolean {
  if (!goal.next_review_at) return false
  return new Date(goal.next_review_at) < new Date(new Date().toDateString())
}

interface Props {
  goal: Goal
  levelLabel: string
  isSelected: boolean
  hasOpenCorrection?: boolean
  onClick: () => void
}

export function NodeCard({ goal, levelLabel, isSelected, hasOpenCorrection, onClick }: Props) {
  const stale = isStale(goal)
  const overdue = isOverdue(goal)
  const sizeClass = LEVEL_SIZES[goal.level] ?? LEVEL_SIZES[4]

  return (
    <div
      onClick={onClick}
      className={[
        'bg-white rounded-lg border-l-4 shadow-sm cursor-pointer select-none',
        'hover:shadow-md transition-shadow',
        STATUS_COLORS[goal.status],
        isSelected ? 'ring-2 ring-gray-400' : '',
        sizeClass,
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] text-gray-400 font-mono">{goal.readable_id}</span>
        <span className="text-[9px] text-gray-300">·</span>
        <span className="text-[9px] text-gray-400">{levelLabel}</span>
      </div>

      {/* Title */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOTS[goal.status]}`} />
        <span className={`font-semibold text-gray-900 leading-tight ${goal.level === 1 ? 'text-sm' : 'text-xs'}`}>
          {goal.title}
        </span>
      </div>

      {/* Owner + metric */}
      <div className="text-[10px] text-gray-500 space-y-0.5">
        {goal.owner && <div>{goal.owner}</div>}
        {(goal.metric_current || goal.metric_target) && (
          <div>{goal.metric_current || '—'} / {goal.metric_target || '—'}</div>
        )}
      </div>

      {/* Review date */}
      {goal.next_review_at && (
        <div className={`text-[10px] mt-1 ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {overdue ? '⚠ overdue' : `Review ${goal.next_review_at}`}
        </div>
      )}

      {/* Alert badges */}
      <div className="flex flex-wrap gap-1 mt-1.5">
        {hasOpenCorrection && (
          <span className="text-[9px] bg-yellow-50 text-yellow-700 border border-yellow-200 rounded px-1.5 py-0.5">
            ⚠ correction
          </span>
        )}
        {stale && (
          <span className="text-[9px] bg-gray-50 text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">
            stale
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test
```
Expected: All tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/
git commit -m "feat: add NodeCard component with status, badges, and stale detection"
```

---

### Task 9: GoalTree + SvgLines + Canvas page

**Files:**
- Create: `src/components/canvas/GoalTree.tsx`
- Create: `src/components/canvas/SvgLines.tsx`
- Create: `src/app/page.tsx`

- [ ] **Step 1: Create a utility to build tree from flat list**

```typescript
// src/lib/build-tree.ts
import type { Goal } from '@/lib/types'

export interface GoalNode extends Goal {
  children: GoalNode[]
}

export function buildTree(goals: Goal[]): GoalNode[] {
  const map = new Map<string, GoalNode>()
  for (const g of goals) map.set(g.id, { ...g, children: [] })

  const roots: GoalNode[] = []
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else if (!node.parent_id) {
      roots.push(node)
    }
  }
  return roots
}
```

- [ ] **Step 2: Write tests for buildTree**

```typescript
// src/lib/__tests__/build-tree.test.ts
import { describe, it, expect } from 'vitest'
import { buildTree } from '@/lib/build-tree'
import type { Goal } from '@/lib/types'

function makeGoal(overrides: Partial<Goal> & { id: string }): Goal {
  return {
    readable_id: 'G-001',
    level: 1,
    title: 'Test',
    owner: '',
    metric_target: '',
    metric_current: '',
    status: 'gray',
    next_review_at: null,
    parent_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildTree', () => {
  it('returns roots with no parent_id', () => {
    const goals = [
      makeGoal({ id: 'a', parent_id: null }),
      makeGoal({ id: 'b', parent_id: null }),
    ]
    const tree = buildTree(goals)
    expect(tree).toHaveLength(2)
  })

  it('nests children under their parent', () => {
    const goals = [
      makeGoal({ id: 'a', parent_id: null }),
      makeGoal({ id: 'b', parent_id: 'a' }),
      makeGoal({ id: 'c', parent_id: 'a' }),
    ]
    const tree = buildTree(goals)
    expect(tree).toHaveLength(1)
    expect(tree[0].children).toHaveLength(2)
  })

  it('handles three levels deep', () => {
    const goals = [
      makeGoal({ id: 'a', parent_id: null }),
      makeGoal({ id: 'b', parent_id: 'a' }),
      makeGoal({ id: 'c', parent_id: 'b' }),
    ]
    const tree = buildTree(goals)
    expect(tree[0].children[0].children[0].id).toBe('c')
  })
})
```

- [ ] **Step 3: Run to verify tests fail**

```bash
npm test
```
Expected: FAIL — buildTree not found.

- [ ] **Step 4: Run tests after implementation**

```bash
npm test
```
Expected: All passing.

- [ ] **Step 5: Implement GoalTree and SvgLines**

```typescript
// src/components/canvas/GoalTree.tsx
'use client'

import { useRef, useState, useLayoutEffect } from 'react'
import type { GoalNode } from '@/lib/build-tree'
import type { HierarchyConfig } from '@/lib/types'
import { NodeCard } from './NodeCard'
import { SvgLines } from './SvgLines'

interface Props {
  node: GoalNode
  config: HierarchyConfig[]
  selectedId: string | null
  openCorrectionIds: Set<string>
  onSelect: (id: string) => void
  depth?: number
}

export function GoalTree({ node, config, selectedId, openCorrectionIds, onSelect, depth = 0 }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  const childRefs = useRef<(HTMLDivElement | null)[]>([])
  const [lines, setLines] = useState<Array<{ x1: number; y1: number; x2: number; y2: number }>>([])

  useLayoutEffect(() => {
    if (!parentRef.current || node.children.length === 0) return
    const parentRect = parentRef.current.getBoundingClientRect()
    const containerRect = parentRef.current.closest('.tree-container')?.getBoundingClientRect()
    if (!containerRect) return

    const newLines = childRefs.current.map((ref) => {
      if (!ref) return null
      const childRect = ref.getBoundingClientRect()
      return {
        x1: parentRect.left - containerRect.left + parentRect.width / 2,
        y1: parentRect.bottom - containerRect.top,
        x2: childRect.left - containerRect.left + childRect.width / 2,
        y2: childRect.top - containerRect.top,
      }
    }).filter(Boolean) as Array<{ x1: number; y1: number; x2: number; y2: number }>

    setLines(newLines)
  })

  const label = config.find(c => c.level === node.level)?.label ?? `Level ${node.level}`

  return (
    <div className="flex flex-col items-center">
      <div ref={parentRef}>
        <NodeCard
          goal={node}
          levelLabel={label}
          isSelected={selectedId === node.id}
          hasOpenCorrection={openCorrectionIds.has(node.id)}
          onClick={() => onSelect(node.id)}
        />
      </div>

      {node.children.length > 0 && (
        <div className="relative tree-container">
          <SvgLines lines={lines} />
          <div className="flex gap-6 mt-8 items-start">
            {node.children.map((child, i) => (
              <div key={child.id} ref={el => { childRefs.current[i] = el }}>
                <GoalTree
                  node={child}
                  config={config}
                  selectedId={selectedId}
                  openCorrectionIds={openCorrectionIds}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

```typescript
// src/components/canvas/SvgLines.tsx

interface Line { x1: number; y1: number; x2: number; y2: number }

export function SvgLines({ lines }: { lines: Line[] }) {
  if (lines.length === 0) return null
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      {lines.map((l, i) => (
        <path
          key={i}
          d={`M ${l.x1} ${l.y1} C ${l.x1} ${(l.y1 + l.y2) / 2}, ${l.x2} ${(l.y1 + l.y2) / 2}, ${l.x2} ${l.y2}`}
          fill="none"
          stroke="#d1d5db"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  )
}
```

- [ ] **Step 6: Implement the main canvas page**

```typescript
// src/app/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { buildTree, type GoalNode } from '@/lib/build-tree'
import { GoalTree } from '@/components/canvas/GoalTree'
import { DetailPanel } from '@/components/panel/DetailPanel'
import type { Goal, HierarchyConfig, Correction } from '@/lib/types'
import Link from 'next/link'

export default function CanvasPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [config, setConfig] = useState<HierarchyConfig[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [goalsRes, configRes] = await Promise.all([
      fetch('/api/goals'),
      fetch('/api/hierarchy'),
    ])
    const goalsData: Goal[] = await goalsRes.json()
    const configData: HierarchyConfig[] = await configRes.json()
    setGoals(goalsData)
    setConfig(configData)

    // Load open corrections for badge display
    const corrRes = await Promise.all(
      goalsData.map(g => fetch(`/api/goals/${g.id}/corrections`).then(r => r.json()))
    )
    setCorrections(corrRes.flat())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const trees: GoalNode[] = buildTree(goals)
  const openCorrectionIds = new Set(
    corrections.filter(c => c.status === 'open').map(c => c.goal_id)
  )
  const selectedGoal = goals.find(g => g.id === selectedId) ?? null

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Canvas area */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-10">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-lg font-bold text-gray-900">Control Panel</h1>
          <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-900">Settings</Link>
        </div>

        {/* Goal trees side by side */}
        <div className="flex gap-16 items-start">
          {trees.map(tree => (
            <GoalTree
              key={tree.id}
              node={tree}
              config={config}
              selectedId={selectedId}
              openCorrectionIds={openCorrectionIds}
              onSelect={setSelectedId}
            />
          ))}

          {/* Add top-level goal button */}
          <AddGoalButton config={config} onCreated={load} />
        </div>
      </div>

      {/* Detail panel */}
      <DetailPanel
        goal={selectedGoal}
        config={config}
        onClose={() => setSelectedId(null)}
        onGoalUpdated={(updated) => {
          setGoals(prev => prev.map(g => g.id === updated.id ? updated : g))
        }}
        onChildAdded={load}
        onCorrectionChange={load}
      />
    </div>
  )
}

function AddGoalButton({ config, onCreated }: { config: HierarchyConfig[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('')
  const [metricTarget, setMetricTarget] = useState('')
  const label = config.find(c => c.level === 1)?.label ?? 'Goal'

  async function handleCreate() {
    if (!title.trim()) return
    await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, owner, metric_target: metricTarget, level: 1 }),
    })
    setOpen(false)
    setTitle('')
    setOwner('')
    setMetricTarget('')
    onCreated()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded-lg px-4 py-2 hover:border-gray-400"
      >
        + Add {label}
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 w-60">
      <div className="text-sm font-medium text-gray-700 mb-3">New {label}</div>
      <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)}
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-gray-300" />
      <input placeholder="Owner" value={owner} onChange={e => setOwner(e.target.value)}
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-gray-300" />
      <input placeholder="Target metric" value={metricTarget} onChange={e => setMetricTarget(e.target.value)}
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-gray-300" />
      <div className="flex gap-2">
        <button onClick={handleCreate}
          className="flex-1 bg-gray-900 text-white rounded px-3 py-1.5 text-sm hover:bg-gray-700">
          Create
        </button>
        <button onClick={() => setOpen(false)}
          className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Build to verify**

```bash
npm run build
```
Expected: Build succeeds (DetailPanel not yet created — add a stub first if needed).

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "feat: add canvas page with goal trees and SVG connectors"
```

---

## Chunk 4: Detail Panel + Check-in Modal

### Task 10: Detail panel

**Files:**
- Create: `src/components/panel/DetailPanel.tsx`
- Create: `src/components/panel/CheckInHistory.tsx`
- Create: `src/components/panel/CorrectionsList.tsx`
- Create: `src/components/panel/NotesList.tsx`

- [ ] **Step 1: Create CheckInHistory**

```typescript
// src/components/panel/CheckInHistory.tsx
import type { CheckIn } from '@/lib/types'

const STATUS_COLORS = { green: 'text-green-600', yellow: 'text-yellow-600', red: 'text-red-600', gray: 'text-gray-400' }

export function CheckInHistory({ checkIns }: { checkIns: CheckIn[] }) {
  if (checkIns.length === 0) {
    return <p className="text-xs text-gray-400 italic">No check-ins yet.</p>
  }
  return (
    <div className="space-y-3">
      {checkIns.map(ci => (
        <div key={ci.id} className="border-l-2 border-gray-100 pl-3">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs font-medium ${STATUS_COLORS[ci.status]}`}>● {ci.status}</span>
            {ci.metric_current && <span className="text-xs text-gray-500">{ci.metric_current}</span>}
          </div>
          {ci.note && <p className="text-xs text-gray-700 leading-relaxed">{ci.note}</p>}
          <p className="text-[10px] text-gray-400 mt-1">
            {new Date(ci.created_at).toLocaleDateString()} · {ci.profile?.display_name ?? 'Unknown'}
          </p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create CorrectionsList**

```typescript
// src/components/panel/CorrectionsList.tsx
import { useState } from 'react'
import type { Correction } from '@/lib/types'

interface Props {
  corrections: Correction[]
  goalId: string
  isAssistant: boolean
  onResolved: (id: string) => void
}

export function CorrectionsList({ corrections, goalId, isAssistant, onResolved }: Props) {
  const [resolving, setResolving] = useState<string | null>(null)
  const open = corrections.filter(c => c.status === 'open')
  const resolved = corrections.filter(c => c.status === 'resolved')

  async function handleResolve(correctionId: string) {
    setResolving(correctionId)
    await fetch(`/api/goals/${goalId}/corrections/${correctionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    })
    setResolving(null)
    onResolved(correctionId)
  }

  return (
    <div className="space-y-2">
      {open.length === 0 && <p className="text-xs text-gray-400 italic">No open corrections.</p>}
      {open.map(c => (
        <div key={c.id} className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <span className="text-[10px] text-yellow-700 font-medium uppercase tracking-wide">{c.type}</span>
              <p className="text-xs text-gray-800 mt-0.5">{c.description}</p>
              <div className="text-[10px] text-gray-500 mt-1 space-x-2">
                {c.due_date && <span>Due {c.due_date}</span>}
                {c.responsible && <span>· {c.responsible}</span>}
              </div>
            </div>
            {isAssistant && (
              <button
                onClick={() => handleResolve(c.id)}
                disabled={resolving === c.id}
                className="text-[10px] text-green-700 border border-green-200 rounded px-2 py-1 hover:bg-green-50 disabled:opacity-50"
              >
                Resolve
              </button>
            )}
          </div>
        </div>
      ))}
      {resolved.length > 0 && (
        <details className="text-[10px] text-gray-400 cursor-pointer">
          <summary>{resolved.length} resolved</summary>
          <div className="space-y-1 mt-1">
            {resolved.map(c => (
              <div key={c.id} className="bg-gray-50 rounded p-2 line-through text-gray-400">
                {c.description}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create NotesList**

```typescript
// src/components/panel/NotesList.tsx
'use client'

import { useState } from 'react'
import type { Note } from '@/lib/types'

interface Props {
  notes: Note[]
  goalId: string
  onAdded: (note: Note) => void
}

export function NotesList({ notes, goalId, onAdded }: Props) {
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!body.trim()) return
    setSaving(true)
    const res = await fetch(`/api/goals/${goalId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (res.ok) {
      const note: Note = await res.json()
      onAdded(note)
      setBody('')
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="space-y-2 mb-3">
        {notes.length === 0 && <p className="text-xs text-gray-400 italic">No notes yet.</p>}
        {notes.map(n => (
          <div key={n.id} className="text-xs text-gray-700">
            <p>{n.body}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {new Date(n.created_at).toLocaleDateString()} · {n.profile?.display_name ?? 'Unknown'}
            </p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add a note…"
          className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAdd()}
        />
        <button onClick={handleAdd} disabled={saving || !body.trim()}
          className="text-xs bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50">
          Add
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create the main DetailPanel**

```typescript
// src/components/panel/DetailPanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Goal, CheckIn, Correction, Note, HierarchyConfig } from '@/lib/types'
import { CheckInHistory } from './CheckInHistory'
import { CorrectionsList } from './CorrectionsList'
import { NotesList } from './NotesList'
import { CheckInModal } from '@/components/modals/CheckInModal'
import { CorrectionModal } from '@/components/modals/CorrectionModal'
import { NewNodeModal } from '@/components/modals/NewNodeModal'

const STATUS_COLORS = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500', gray: 'bg-gray-300' }

interface Props {
  goal: Goal | null
  config: HierarchyConfig[]
  onClose: () => void
  onGoalUpdated: (goal: Goal) => void
  onChildAdded: () => void
  onCorrectionChange: () => void
}

export function DetailPanel({ goal, config, onClose, onGoalUpdated, onChildAdded, onCorrectionChange }: Props) {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [isAssistant, setIsAssistant] = useState(false)
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [showCorrection, setShowCorrection] = useState(false)
  const [showAddChild, setShowAddChild] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setIsAssistant(data?.role === 'assistant')
    })
  }, [])

  useEffect(() => {
    if (!goal) return
    Promise.all([
      fetch(`/api/goals/${goal.id}/checkins`).then(r => r.json()),
      fetch(`/api/goals/${goal.id}/corrections`).then(r => r.json()),
      fetch(`/api/goals/${goal.id}/notes`).then(r => r.json()),
    ]).then(([ci, corr, n]) => {
      setCheckIns(ci)
      setCorrections(corr)
      setNotes(n)
    })
  }, [goal])

  if (!goal) {
    return (
      <div className="w-0 transition-all duration-300" />
    )
  }

  const label = config.find(c => c.level === goal.level)?.label ?? `Level ${goal.level}`
  const childLabel = config.find(c => c.level === goal.level + 1)?.label

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col h-screen overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[goal.status]}`} />
            <span className="text-[10px] text-gray-400 font-mono">{goal.readable_id}</span>
            <span className="text-[10px] text-gray-300">·</span>
            <span className="text-[10px] text-gray-400">{label}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <h2 className="text-sm font-bold text-gray-900">{goal.title}</h2>

        {/* Attributes */}
        <div className="mt-2 space-y-1 text-xs text-gray-600">
          {goal.owner && <div><span className="text-gray-400">Owner</span> {goal.owner}</div>}
          {(goal.metric_current || goal.metric_target) && (
            <div><span className="text-gray-400">Metric</span> {goal.metric_current || '—'} / {goal.metric_target || '—'}</div>
          )}
          {goal.next_review_at && (
            <div><span className="text-gray-400">Next review</span> {goal.next_review_at}</div>
          )}
        </div>

        {/* Actions — assistant only */}
        {isAssistant && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => setShowCheckIn(true)}
              className="text-xs bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-700">
              + Check-in
            </button>
            <button onClick={() => setShowCorrection(true)}
              className="text-xs border border-gray-200 rounded px-3 py-1.5 text-gray-600 hover:bg-gray-50">
              + Correction
            </button>
            {childLabel && (
              <button onClick={() => setShowAddChild(true)}
                className="text-xs border border-gray-200 rounded px-3 py-1.5 text-gray-600 hover:bg-gray-50">
                + {childLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Check-in History</h3>
          <CheckInHistory checkIns={checkIns} />
        </section>

        <section>
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Corrections</h3>
          <CorrectionsList
            corrections={corrections}
            goalId={goal.id}
            isAssistant={isAssistant}
            onResolved={(id) => {
              setCorrections(prev => prev.map(c => c.id === id ? { ...c, status: 'resolved' as const } : c))
              onCorrectionChange()
            }}
          />
        </section>

        <section>
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h3>
          <NotesList
            notes={notes}
            goalId={goal.id}
            onAdded={note => setNotes(prev => [note, ...prev])}
          />
        </section>
      </div>

      {/* Modals */}
      {showCheckIn && (
        <CheckInModal
          goalId={goal.id}
          onClose={() => setShowCheckIn(false)}
          onSaved={(ci, updatedGoal) => {
            setCheckIns(prev => [ci, ...prev])
            onGoalUpdated(updatedGoal)
            setShowCheckIn(false)
          }}
        />
      )}
      {showCorrection && (
        <CorrectionModal
          goalId={goal.id}
          onClose={() => setShowCorrection(false)}
          onSaved={(correction) => {
            setCorrections(prev => [correction, ...prev])
            onCorrectionChange()
            setShowCorrection(false)
          }}
        />
      )}
      {showAddChild && childLabel && (
        <NewNodeModal
          parentId={goal.id}
          level={goal.level + 1}
          levelLabel={childLabel}
          onClose={() => setShowAddChild(false)}
          onCreated={() => {
            setShowAddChild(false)
            onChildAdded()
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/panel/
git commit -m "feat: add detail panel with check-in history, corrections, and notes"
```

---

### Task 11: Check-in, Correction, and New Node modals

**Files:**
- Create: `src/components/modals/CheckInModal.tsx`
- Create: `src/components/modals/CorrectionModal.tsx`
- Create: `src/components/modals/NewNodeModal.tsx`

- [ ] **Step 1: Create modal wrapper component**

```typescript
// src/components/modals/ModalWrapper.tsx
export function ModalWrapper({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create CheckInModal**

```typescript
// src/components/modals/CheckInModal.tsx
'use client'

import { useState } from 'react'
import type { CheckIn, Goal, NodeStatus } from '@/lib/types'
import { ModalWrapper } from './ModalWrapper'

interface Props {
  goalId: string
  onClose: () => void
  onSaved: (checkIn: CheckIn, updatedGoal: Goal) => void
}

export function CheckInModal({ goalId, onClose, onSaved }: Props) {
  const [status, setStatus] = useState<NodeStatus>('green')
  const [metricCurrent, setMetricCurrent] = useState('')
  const [note, setNote] = useState('')
  const [nextReviewAt, setNextReviewAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/goals/${goalId}/checkins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, metric_current: metricCurrent, note, next_review_at: nextReviewAt || null }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to save')
      setSaving(false)
      return
    }
    const checkIn: CheckIn = await res.json()

    // Fetch updated goal
    const goalRes = await fetch(`/api/goals/${goalId}`)
    const updatedGoal: Goal = await goalRes.json()

    onSaved(checkIn, updatedGoal)
  }

  return (
    <ModalWrapper onClose={onClose}>
      <h3 className="text-sm font-bold text-gray-900 mb-4">New Check-in</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <div className="flex gap-2">
            {(['green', 'yellow', 'red', 'gray'] as NodeStatus[]).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`flex-1 py-1.5 rounded text-xs font-medium capitalize border ${
                  status === s ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Metric progress</label>
          <input value={metricCurrent} onChange={e => setMetricCurrent(e.target.value)}
            placeholder="e.g. $2.1M ARR"
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Update note</label>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="What happened? What's next?"
            rows={3}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 resize-none" />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Next review date</label>
          <input type="date" value={nextReviewAt} onChange={e => setNextReviewAt(e.target.value)}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
        </div>
      </div>

      {error && <p className="text-red-600 text-xs mt-3">{error}</p>}

      <div className="flex gap-2 mt-5">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save check-in'}
        </button>
        <button onClick={onClose}
          className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </ModalWrapper>
  )
}
```

- [ ] **Step 3: Add GET /api/goals/[id] route (needed by CheckInModal)**

```typescript
// Add to src/app/api/goals/[id]/route.ts (before the PATCH export)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.from('goals').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 4: Create CorrectionModal**

```typescript
// src/components/modals/CorrectionModal.tsx
'use client'

import { useState } from 'react'
import type { Correction, CorrectionType } from '@/lib/types'
import { ModalWrapper } from './ModalWrapper'

interface Props {
  goalId: string
  onClose: () => void
  onSaved: (correction: Correction) => void
}

export function CorrectionModal({ goalId, onClose, onSaved }: Props) {
  const [type, setType] = useState<CorrectionType>('scope')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [responsible, setResponsible] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!description.trim()) { setError('Description is required'); return }
    setSaving(true)
    const res = await fetch(`/api/goals/${goalId}/corrections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, description, due_date: dueDate || null, responsible }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to save')
      setSaving(false)
      return
    }
    const correction: Correction = await res.json()
    onSaved(correction)
  }

  return (
    <ModalWrapper onClose={onClose}>
      <h3 className="text-sm font-bold text-gray-900 mb-4">Add Correction</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <select value={type} onChange={e => setType(e.target.value as CorrectionType)}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300">
            <option value="scope">Scope</option>
            <option value="timeline">Timeline</option>
            <option value="resource">Resource</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What needs to be corrected?"
            rows={3}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 resize-none" />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Due date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Responsible</label>
          <input value={responsible} onChange={e => setResponsible(e.target.value)}
            placeholder="Who is responsible?"
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
        </div>
      </div>

      {error && <p className="text-red-600 text-xs mt-3">{error}</p>}

      <div className="flex gap-2 mt-5">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Add correction'}
        </button>
        <button onClick={onClose}
          className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </ModalWrapper>
  )
}
```

- [ ] **Step 5: Create NewNodeModal**

```typescript
// src/components/modals/NewNodeModal.tsx
'use client'

import { useState } from 'react'
import { ModalWrapper } from './ModalWrapper'

interface Props {
  parentId: string
  level: number
  levelLabel: string
  onClose: () => void
  onCreated: () => void
}

export function NewNodeModal({ parentId, level, levelLabel, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('')
  const [metricTarget, setMetricTarget] = useState('')
  const [nextReviewAt, setNextReviewAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, owner, metric_target: metricTarget, level, parent_id: parentId, next_review_at: nextReviewAt || null }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to create')
      setSaving(false)
      return
    }
    onCreated()
  }

  return (
    <ModalWrapper onClose={onClose}>
      <h3 className="text-sm font-bold text-gray-900 mb-4">Add {levelLabel}</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Owner</label>
          <input value={owner} onChange={e => setOwner(e.target.value)}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Target metric</label>
          <input value={metricTarget} onChange={e => setMetricTarget(e.target.value)}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Next review date</label>
          <input type="date" value={nextReviewAt} onChange={e => setNextReviewAt(e.target.value)}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
        </div>
      </div>

      {error && <p className="text-red-600 text-xs mt-3">{error}</p>}

      <div className="flex gap-2 mt-5">
        <button onClick={handleCreate} disabled={saving}
          className="flex-1 bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
          {saving ? 'Creating…' : `Create ${levelLabel}`}
        </button>
        <button onClick={onClose}
          className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </ModalWrapper>
  )
}
```

- [ ] **Step 6: Build to verify all components compile**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 7: Run all tests**

```bash
npm test
```
Expected: All tests passing.

- [ ] **Step 8: Commit**

```bash
git add src/components/modals/ src/app/api/goals/
git commit -m "feat: add check-in, correction, and new node modals"
```

---

## Chunk 5: Settings Page + Sign Out

### Task 12: Settings page + sign out

**Files:**
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: Implement settings page**

```typescript
// src/app/settings/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { HierarchyConfig, Profile } from '@/lib/types'
import Link from 'next/link'

export default function SettingsPage() {
  const [config, setConfig] = useState<HierarchyConfig[]>([])
  const [labels, setLabels] = useState<Record<number, string>>({})
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [configRes, { data: { user } }] = await Promise.all([
        fetch('/api/hierarchy'),
        supabase.auth.getUser(),
      ])
      const configData: HierarchyConfig[] = await configRes.json()
      setConfig(configData)
      setLabels(Object.fromEntries(configData.map(c => [c.level, c.label])))

      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(data)
      }
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    const updates = config.map(c => ({ level: c.level, label: labels[c.level] ?? c.label }))
    await fetch('/api/hierarchy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isAssistant = profile?.role === 'assistant'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-lg font-bold text-gray-900">Settings</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Canvas</Link>
        </div>

        {/* Hierarchy labels — assistant only */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Hierarchy Levels</h2>
          <div className="space-y-3">
            {config.map(c => (
              <div key={c.level} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-14">Level {c.level}</span>
                <input
                  value={labels[c.level] ?? c.label}
                  onChange={e => setLabels(prev => ({ ...prev, [c.level]: e.target.value }))}
                  disabled={!isAssistant}
                  className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            ))}
          </div>
          {isAssistant && (
            <button onClick={handleSave} disabled={saving}
              className="mt-4 bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save labels'}
            </button>
          )}
        </div>

        {/* Users — read-only display */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Users</h2>
          <p className="text-xs text-gray-500">This app has two fixed accounts. To change passwords, use the Supabase dashboard.</p>
          <div className="mt-3 space-y-2">
            {(['ceo', 'assistant'] as const).map(role => (
              <div key={role} className="flex items-center gap-2 text-xs text-gray-700">
                <span className={`w-2 h-2 rounded-full ${role === 'ceo' ? 'bg-blue-400' : 'bg-green-400'}`} />
                <span className="capitalize font-medium">{role}</span>
                {profile?.role === role && <span className="text-gray-400">(you)</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <button onClick={handleSignOut}
          className="text-sm text-red-600 hover:text-red-800">
          Sign out
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build to verify**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Run all tests**

```bash
npm test
```
Expected: All tests passing.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/
git commit -m "feat: add settings page with hierarchy config and sign out"
```

---

## Final Verification

- [ ] **Start dev server and manually verify:**

```bash
npm run dev
```

1. Visit `http://localhost:3000` → redirects to `/login`
2. Log in as assistant → lands on canvas
3. Create a top-level goal → appears in canvas with readable ID `G-001`
4. Add a child initiative to it → appears below with `I-001` and SVG line
5. Click a node → detail panel slides in
6. Submit a check-in → node status updates, appears in history
7. Add a correction → yellow badge appears on node
8. Resolve correction → badge disappears
9. Add a note → appears in notes list
10. Log out and log in as CEO → can view everything, "+" buttons not visible, no check-in/correction buttons
11. Visit `/settings` → can see hierarchy config (read-only for CEO), edit labels as assistant

- [ ] **Final commit**

```bash
git add -A
git commit -m "chore: final verification complete"
```
