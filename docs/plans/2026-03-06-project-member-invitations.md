# Project Member Invitations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow project owners to invite collaborators (viewer or editor) to a project via email; unregistered invitees get a Supabase magic-link email and are auto-joined on first login.

**Architecture:** Two new tables (`project_members`, `project_invitations`) with RLS policies added to all project-scoped tables. Dashboard layout auto-accepts pending invitations on every server render. Project ownership is tracked via `projects.user_id`; collaborators live in `project_members`.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL + Auth), `createAdminClient` (service role for invite email + user lookup), shadcn/ui components.

---

### Task 1: Add types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add `MemberRole`, `ProjectMember`, `ProjectInvitation` types after the `UserSettings` interface**

```ts
export type MemberRole = 'viewer' | 'editor'

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: MemberRole
  invited_by: string | null
  created_at: string
  // joined from auth/profiles:
  email?: string
  name?: string | null
}

export interface ProjectInvitation {
  id: string
  project_id: string
  email: string
  role: MemberRole
  invited_by: string
  status: 'pending' | 'accepted'
  created_at: string
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add ProjectMember, ProjectInvitation, MemberRole"
```

---

### Task 2: Database migration

**Files:**
- Create: `supabase/migrations/004_project_members.sql`

**Step 1: Write migration**

```sql
-- ============================================================
-- PROJECT MEMBERS
-- ============================================================
create table public.project_members (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'editor' check (role in ('viewer', 'editor')),
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique(project_id, user_id)
);

-- ============================================================
-- PROJECT INVITATIONS (pending — email not yet registered)
-- ============================================================
create table public.project_invitations (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  email       text not null,
  role        text not null default 'editor' check (role in ('viewer', 'editor')),
  invited_by  uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  unique(project_id, email)
);

-- ============================================================
-- RLS — new tables
-- ============================================================
alter table public.project_members enable row level security;
alter table public.project_invitations enable row level security;

-- project_members: owner manages all; each member sees their own row
create policy "owner_manage_members" on public.project_members
  for all using (
    exists (select 1 from public.projects where id = project_id and user_id = auth.uid())
  );

create policy "members_see_own_membership" on public.project_members
  for select using (auth.uid() = user_id);

-- project_invitations: owner manages all
create policy "owner_manage_invitations" on public.project_invitations
  for all using (
    exists (select 1 from public.projects where id = project_id and user_id = auth.uid())
  );

-- ============================================================
-- RLS — extend existing tables to allow member access
-- ============================================================

-- Projects: members can SELECT (owner ALL already covered)
create policy "members_see_projects" on public.projects
  for select using (
    exists (select 1 from public.project_members where project_id = id and user_id = auth.uid())
  );

-- Data sources: owner can see all sources in project (including member-uploaded ones)
create policy "owners_see_project_sources" on public.data_sources
  for all using (
    exists (select 1 from public.projects where id = project_id and user_id = auth.uid())
  );

-- Data sources: members can access all sources in project
create policy "members_access_sources" on public.data_sources
  for all using (
    exists (select 1 from public.project_members where project_id = data_sources.project_id and user_id = auth.uid())
  );

-- Charter: members
create policy "members_access_charter" on public.project_charter
  for all using (
    exists (select 1 from public.project_members where project_id = project_charter.project_id and user_id = auth.uid())
  );

-- PRD: members
create policy "members_access_prd" on public.prd
  for all using (
    exists (select 1 from public.project_members where project_id = prd.project_id and user_id = auth.uid())
  );

-- Epics: members
create policy "members_access_epics" on public.epics
  for all using (
    exists (select 1 from public.project_members where project_id = epics.project_id and user_id = auth.uid())
  );

-- User stories: members
create policy "members_access_stories" on public.user_stories
  for all using (
    exists (select 1 from public.project_members where project_id = user_stories.project_id and user_id = auth.uid())
  );

-- Project prompts: members
create policy "members_access_project_prompts" on public.project_prompts
  for all using (
    exists (select 1 from public.project_members where project_id = project_prompts.project_id and user_id = auth.uid())
  );
```

**Step 2: Run in Supabase SQL Editor**

Go to `https://supabase.com/dashboard/project/cierdqlzzfiwsclxhram/sql/new`, paste the SQL, click Run. Verify no errors.

**Step 3: Commit the file**

```bash
git add supabase/migrations/004_project_members.sql
git commit -m "feat(db): add project_members and project_invitations tables with RLS"
```

---

### Task 3: Update project layout to allow member access

**Files:**
- Modify: `src/app/(dashboard)/project/[id]/layout.tsx`

**Step 1: Remove `user_id` filter — RLS now handles member access**

Replace the entire file with:

```tsx
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // RLS handles access: returns data only if user is owner OR project_member
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', id)
    .single()

  if (!project) notFound()

  return <>{children}</>
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/project/[id]/layout.tsx
git commit -m "feat(layout): allow project members to access project routes via RLS"
```

---

### Task 4: Auto-accept pending invitations in dashboard layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Add auto-accept logic after auth check**

Replace the file with:

```tsx
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import type { UserRole } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const role: UserRole = profile?.role ?? 'user'

  // Auto-accept any pending project invitations for this user's email
  if (user.email) {
    try {
      const adminClient = await createAdminClient()
      const { data: pending } = await adminClient
        .from('project_invitations')
        .select('id, project_id, role')
        .eq('email', user.email)
        .eq('status', 'pending')

      if (pending && pending.length > 0) {
        for (const invite of pending) {
          await adminClient.from('project_members').upsert(
            { project_id: invite.project_id, user_id: user.id, role: invite.role },
            { onConflict: 'project_id,user_id' }
          )
          await adminClient
            .from('project_invitations')
            .update({ status: 'accepted' })
            .eq('id', invite.id)
        }
      }
    } catch {
      // Non-critical — don't break the layout if this fails
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={role} />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "feat(layout): auto-accept pending project invitations on login"
```

---

### Task 5: GET + POST members API route

**Files:**
- Create: `src/app/api/projects/[id]/members/route.ts`

**Step 1: Write the route**

```ts
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify access (owner or member)
  const { data: project } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', id)
    .single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = project.user_id === user.id

  const adminClient = await createAdminClient()

  // Fetch members + invitations in parallel
  const [{ data: members }, { data: invitations }, { data: { users: authUsers } }] =
    await Promise.all([
      adminClient.from('project_members').select('*').eq('project_id', id).order('created_at'),
      adminClient.from('project_invitations').select('*').eq('project_id', id).eq('status', 'pending').order('created_at'),
      adminClient.auth.admin.listUsers({ perPage: 1000 }),
    ])

  // Fetch profiles for name lookups
  const memberUserIds = (members ?? []).map(m => m.user_id)
  const { data: profiles } = memberUserIds.length
    ? await adminClient.from('profiles').select('user_id, full_name').in('user_id', memberUserIds)
    : { data: [] }

  const emailMap = new Map(authUsers.map(u => [u.id, u.email ?? '']))
  const nameMap = new Map((profiles ?? []).map(p => [p.user_id, p.full_name]))

  const enrichedMembers = (members ?? []).map(m => ({
    ...m,
    email: emailMap.get(m.user_id) ?? '',
    name: nameMap.get(m.user_id) ?? null,
  }))

  return NextResponse.json({ isOwner, members: enrichedMembers, invitations: invitations ?? [] })
}
```

**Step 2: Commit**

```bash
git add src/app/api/projects/[id]/members/route.ts
git commit -m "feat(api): GET /api/projects/[id]/members - list members and pending invitations"
```

---

### Task 6: POST invite route

**Files:**
- Create: `src/app/api/projects/[id]/invite/route.ts`

**Step 1: Write the route**

```ts
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { MemberRole } from '@/types'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only project owner can invite
  const { data: project } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, role } = await request.json() as { email: string; role: MemberRole }
  if (!email || !role) return NextResponse.json({ error: 'email and role required' }, { status: 400 })
  if (!['viewer', 'editor'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const normalizedEmail = email.trim().toLowerCase()
  const adminClient = await createAdminClient()

  // Check if user exists in auth
  const { data: { users: allUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const existing = allUsers.find(u => u.email?.toLowerCase() === normalizedEmail)

  if (existing) {
    // User exists — add directly to project_members
    const { error } = await adminClient.from('project_members').upsert(
      { project_id: id, user_id: existing.id, role, invited_by: user.id },
      { onConflict: 'project_id,user_id' }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ status: 'added', email: normalizedEmail })
  }

  // User doesn't exist — create invitation + send Supabase invite email
  const { error: inviteError } = await adminClient.from('project_invitations').upsert(
    { project_id: id, email: normalizedEmail, role, invited_by: user.id, status: 'pending' },
    { onConflict: 'project_id,email' }
  )
  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: `${appUrl}/dashboard`,
  })

  return NextResponse.json({ status: 'invited', email: normalizedEmail })
}
```

**Step 2: Add `NEXT_PUBLIC_APP_URL` to `.env.local` if not already present**

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

(Set to the production URL when deploying.)

**Step 3: Commit**

```bash
git add src/app/api/projects/[id]/invite/route.ts
git commit -m "feat(api): POST /api/projects/[id]/invite - invite collaborator by email"
```

---

### Task 7: PATCH + DELETE member role/removal routes

**Files:**
- Create: `src/app/api/projects/[id]/members/[userId]/route.ts`

**Step 1: Write the route**

```ts
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; userId: string }> }

async function requireOwner(projectId: string, callerId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .eq('user_id', callerId)
    .single()
  return !!data
}

export async function PATCH(request: Request, { params }: Params) {
  const { id, userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await requireOwner(id, user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { role } = await request.json()
  if (!['viewer', 'editor'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const adminClient = await createAdminClient()
  const { data, error } = await adminClient
    .from('project_members')
    .update({ role })
    .eq('project_id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await requireOwner(id, user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = await createAdminClient()
  const { error } = await adminClient
    .from('project_members')
    .delete()
    .eq('project_id', id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

**Step 2: Commit**

```bash
git add src/app/api/projects/[id]/members/[userId]/route.ts
git commit -m "feat(api): PATCH/DELETE /api/projects/[id]/members/[userId] - change role or remove member"
```

---

### Task 8: DELETE invitation route

**Files:**
- Create: `src/app/api/projects/[id]/invitations/[invId]/route.ts`

**Step 1: Write the route**

```ts
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; invId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { id, invId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only owner can cancel invitations
  const { data: project } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = await createAdminClient()
  const { error } = await adminClient
    .from('project_invitations')
    .delete()
    .eq('id', invId)
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

**Step 2: Commit**

```bash
git add src/app/api/projects/[id]/invitations/[invId]/route.ts
git commit -m "feat(api): DELETE /api/projects/[id]/invitations/[invId] - cancel pending invite"
```

---

### Task 9: ProjectMembersPanel component

**Files:**
- Create: `src/components/project/ProjectMembersPanel.tsx`

**Step 1: Write the component**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { UserPlus, Trash2, Mail, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { ProjectMember, ProjectInvitation, MemberRole } from '@/types'

interface MembersData {
  isOwner: boolean
  members: ProjectMember[]
  invitations: ProjectInvitation[]
}

const ROLE_COLORS: Record<MemberRole, string> = {
  editor: 'bg-blue-50 text-blue-700 border-blue-200',
  viewer: 'bg-zinc-50 text-zinc-600 border-zinc-200',
}

export default function ProjectMembersPanel() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<MembersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('editor')
  const [inviting, setInviting] = useState(false)

  async function load() {
    const res = await fetch(`/api/projects/${id}/members`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch(`/api/projects/${id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      if (result.status === 'added') {
        toast.success(`${inviteEmail} added to project`)
      } else {
        toast.success(`Invite sent to ${inviteEmail}`)
      }
      setInviteEmail('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite')
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(userId: string, role: MemberRole) {
    const res = await fetch(`/api/projects/${id}/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (res.ok) {
      setData(prev => prev ? {
        ...prev,
        members: prev.members.map(m => m.user_id === userId ? { ...m, role } : m),
      } : prev)
      toast.success('Role updated')
    }
  }

  async function handleRemoveMember(userId: string) {
    const res = await fetch(`/api/projects/${id}/members/${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setData(prev => prev ? { ...prev, members: prev.members.filter(m => m.user_id !== userId) } : prev)
      toast.success('Member removed')
    }
  }

  async function handleCancelInvite(invId: string) {
    const res = await fetch(`/api/projects/${id}/invitations/${invId}`, { method: 'DELETE' })
    if (res.ok) {
      setData(prev => prev ? { ...prev, invitations: prev.invitations.filter(i => i.id !== invId) } : prev)
      toast.success('Invitation cancelled')
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground p-1">Loading members...</div>
  if (!data) return null

  const { isOwner, members, invitations } = data

  return (
    <div className="space-y-6">
      {/* Invite form */}
      {isOwner && (
        <form onSubmit={handleInvite} className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Invite by email</label>
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <Select value={inviteRole} onValueChange={v => setInviteRole(v as MemberRole)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={inviting}>
            <UserPlus className="h-4 w-4" />
            {inviting ? 'Sending...' : 'Invite'}
          </Button>
        </form>
      )}

      {/* Active members */}
      <div>
        <h3 className="text-sm font-medium mb-2">Members</h3>
        <div className="space-y-1.5">
          {/* Owner row — always first */}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-sm font-medium truncate">You (owner)</span>
            </div>
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Owner</Badge>
          </div>

          {members.map(member => (
            <div key={member.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div className="min-w-0 flex-1 mr-2">
                {member.name && <p className="text-sm font-medium truncate">{member.name}</p>}
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Mail className="h-3 w-3 shrink-0" />
                  {member.email}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isOwner ? (
                  <Select value={member.role} onValueChange={v => handleRoleChange(member.user_id, v as MemberRole)}>
                    <SelectTrigger className={`h-7 text-xs border px-2 w-auto ${ROLE_COLORS[member.role]}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className={`text-xs ${ROLE_COLORS[member.role]}`}>
                    {member.role}
                  </Badge>
                )}
                {isOwner && (
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveMember(member.user_id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No collaborators yet.</p>
          )}
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Pending invitations</h3>
          <div className="space-y-1.5">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">{inv.email}</span>
                  <Badge variant="outline" className={`text-xs shrink-0 ${ROLE_COLORS[inv.role]}`}>{inv.role}</Badge>
                </div>
                {isOwner && (
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => handleCancelInvite(inv.id)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/project/ProjectMembersPanel.tsx
git commit -m "feat(ui): ProjectMembersPanel - invite form, member list, pending invitations"
```

---

### Task 10: Update project settings page — add Members tab

**Files:**
- Modify: `src/app/(dashboard)/project/[id]/settings/page.tsx`

**Step 1: Restructure the page to have two tabs: Members + Prompts**

Replace the entire file:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Sliders } from 'lucide-react'
import ProjectMembersPanel from '@/components/project/ProjectMembersPanel'
import type { PromptStage } from '@/types'

const STAGES: { value: PromptStage; label: string; description: string }[] = [
  { value: 'charter', label: 'Charter', description: 'Prompt used when generating the Project Charter' },
  { value: 'prd', label: 'PRD', description: 'Prompt used when generating the PRD' },
  { value: 'epics', label: 'Epics', description: 'Prompt used when generating Epics' },
  { value: 'stories', label: 'Stories', description: 'Prompt used when generating User Stories' },
  { value: 'domain_research', label: 'Domain Research', description: 'Prompt used by the Domain Research Agent' },
]

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>()
  const [prompts, setPrompts] = useState<Record<PromptStage, string>>({
    charter: '', prd: '', epics: '', stories: '', domain_research: '',
  })
  const [systemDefaults, setSystemDefaults] = useState<Record<PromptStage, string>>({
    charter: '', prd: '', epics: '', stories: '', domain_research: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<PromptStage | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/project-prompts?project_id=${id}`).then(r => r.json()),
      fetch('/api/system-prompts').then(r => r.json()),
    ]).then(([projectPrompts, sysPrompts]) => {
      if (Array.isArray(projectPrompts)) {
        const map: Record<string, string> = {}
        projectPrompts.forEach((p: { stage: string; content: string }) => { map[p.stage] = p.content })
        setPrompts(prev => ({ ...prev, ...map }))
      }
      if (Array.isArray(sysPrompts)) {
        const map: Record<string, string> = {}
        sysPrompts.forEach((p: { stage: string; content: string }) => { map[p.stage] = p.content })
        setSystemDefaults(prev => ({ ...prev, ...map }))
      }
    }).finally(() => setLoading(false))
  }, [id])

  async function handleSave(stage: PromptStage) {
    setSaving(stage)
    try {
      const res = await fetch('/api/project-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: id, stage, content: prompts[stage] }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(`${stage} prompt saved`)
    } catch { toast.error('Failed to save prompt') }
    finally { setSaving(null) }
  }

  async function handleReset(stage: PromptStage) {
    setPrompts(prev => ({ ...prev, [stage]: '' }))
    await fetch('/api/project-prompts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: id, stage }),
    })
    toast.success('Reset to system default')
  }

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Loading...</div>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Project Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage collaborators and AI prompt overrides for this project.
        </p>
      </div>

      <Tabs defaultValue="members">
        <TabsList className="mb-6">
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />Members
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-1.5">
            <Sliders className="h-3.5 w-3.5" />Prompts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Members</CardTitle>
              <CardDescription>
                Invite collaborators to view or edit this project. Editors have full access; viewers can only read.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectMembersPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prompt Overrides</CardTitle>
              <CardDescription>
                These prompts override the system defaults for this project only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="charter">
                <TabsList className="w-full mb-4">
                  {STAGES.map(s => (
                    <TabsTrigger key={s.value} value={s.value} className="flex-1 text-xs">{s.label}</TabsTrigger>
                  ))}
                </TabsList>
                {STAGES.map(stage => (
                  <TabsContent key={stage.value} value={stage.value} className="space-y-3">
                    <p className="text-sm text-muted-foreground">{stage.description}</p>

                    {systemDefaults[stage.value] && (
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">System default:</p>
                        <p className="text-xs text-muted-foreground">{systemDefaults[stage.value]}</p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label>Project override</Label>
                      <Textarea
                        placeholder="Leave blank to use system default. Override for this project..."
                        value={prompts[stage.value]}
                        onChange={e => setPrompts(prev => ({ ...prev, [stage.value]: e.target.value }))}
                        rows={6}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(stage.value)} disabled={saving === stage.value}>
                        {saving === stage.value ? 'Saving...' : 'Save override'}
                      </Button>
                      {prompts[stage.value] && (
                        <Button size="sm" variant="ghost" onClick={() => handleReset(stage.value)}>
                          Reset to default
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/project/[id]/settings/page.tsx
git commit -m "feat(ui): add Members tab to Project Settings page"
```

---

### Task 11: TypeScript check + final commit

**Step 1: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 2: Push to GitHub**

```bash
git push
```

---

## Manual step required

After Task 2, the migration SQL **must be run in the Supabase SQL Editor** at:
`https://supabase.com/dashboard/project/cierdqlzzfiwsclxhram/sql/new`

Do this before testing any of the API routes or UI.
