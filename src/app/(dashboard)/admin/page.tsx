'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Shield, Users, FolderOpen, MessageSquare, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { PromptStage } from '@/types'

interface AdminUser {
  user_id: string
  email: string
  role: 'admin' | 'user'
  full_name: string | null
  created_at: string
}

interface AdminProject {
  id: string
  name: string
  client_name: string | null
  status: string
  type: string
  user_id: string
  created_at: string
}

const STAGES: { value: PromptStage; label: string }[] = [
  { value: 'charter', label: 'Project Charter' },
  { value: 'prd', label: 'PRD' },
  { value: 'epics', label: 'Epics' },
  { value: 'stories', label: 'User Stories' },
  { value: 'domain_research', label: 'Domain Research' },
]

const STATUS_COLORS: Record<string, string> = {
  setup: 'bg-zinc-100 text-zinc-600',
  sources: 'bg-blue-50 text-blue-600',
  charter: 'bg-purple-50 text-purple-600',
  prd: 'bg-indigo-50 text-indigo-600',
  epics: 'bg-amber-50 text-amber-600',
  stories: 'bg-orange-50 text-orange-600',
  approved: 'bg-green-50 text-green-700',
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [prompts, setPrompts] = useState<Record<PromptStage, string>>({
    charter: '', prd: '', epics: '', stories: '', domain_research: '',
  })
  const [loading, setLoading] = useState(true)
  const [savingPrompt, setSavingPrompt] = useState<PromptStage | null>(null)
  const [updatingUser, setUpdatingUser] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/users').then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch('/api/admin/projects').then(r => r.ok ? r.json() : []),
      fetch('/api/system-prompts').then(r => r.json()),
    ]).then(([u, p, sp]) => {
      setUsers(Array.isArray(u) ? u : [])
      setProjects(Array.isArray(p) ? p : [])
      if (Array.isArray(sp)) {
        const map: Record<string, string> = {}
        sp.forEach((s: { stage: string; content: string }) => { map[s.stage] = s.content })
        setPrompts(prev => ({ ...prev, ...map }))
      }
    }).catch(status => {
      if (status === 403) {
        toast.error('Admin access required')
        router.push('/dashboard')
      }
    }).finally(() => setLoading(false))
  }, [router])

  async function updateRole(userId: string, role: 'admin' | 'user') {
    setUpdatingUser(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role } : u))
      toast.success('Role updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setUpdatingUser(null)
    }
  }

  async function savePrompt(stage: PromptStage) {
    setSavingPrompt(stage)
    try {
      const res = await fetch('/api/system-prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, content: prompts[stage] }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(`${stage} prompt saved`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save prompt')
    } finally {
      setSavingPrompt(null)
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Loading...</div>

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage users, projects, and system configuration</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-xs text-muted-foreground">Total users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{projects.length}</p>
              <p className="text-xs text-muted-foreground">Total projects</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="projects">All Projects</TabsTrigger>
          <TabsTrigger value="prompts">System Prompts</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Users</CardTitle>
              <CardDescription>Manage user accounts and roles</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Change role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium text-sm">{user.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.full_name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge className={user.role === 'admin'
                          ? 'bg-purple-100 text-purple-700 border-purple-200'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={v => updateRole(user.user_id, v as 'admin' | 'user')}
                          disabled={updatingUser === user.user_id}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Projects</CardTitle>
              <CardDescription>Projects across all users</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map(project => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium text-sm">{project.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{project.client_name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{project.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[project.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                          {project.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Prompts Tab */}
        <TabsContent value="prompts">
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              These are the default AI prompts used for all projects. Individual projects can override these in their own settings.
            </p>
            {STAGES.map(stage => (
              <Card key={stage.value}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">{stage.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">System prompt</Label>
                    <Textarea
                      value={prompts[stage.value]}
                      onChange={e => setPrompts(prev => ({ ...prev, [stage.value]: e.target.value }))}
                      rows={4}
                      className="text-sm"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => savePrompt(stage.value)}
                    disabled={savingPrompt === stage.value}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingPrompt === stage.value ? 'Saving...' : 'Save prompt'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
