'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Eye, EyeOff } from 'lucide-react'

const MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (Most capable)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fastest)' },
]

const STAGES: { key: string; label: string; description: string }[] = [
  { key: 'charter',         label: 'Charter',         description: 'Guides AI when generating the Project Charter from source documents.' },
  { key: 'prd',             label: 'PRD',              description: 'Guides AI when generating the Product Requirements Document.' },
  { key: 'epics',           label: 'Epics',            description: 'Guides AI when breaking the PRD into Epics.' },
  { key: 'stories',         label: 'Stories',          description: 'Guides AI when generating User Stories from Epics.' },
  { key: 'domain_research', label: 'Domain Research',  description: 'Guides the Domain Research Agent when synthesising industry knowledge.' },
]

type SystemPrompts = Record<string, string>

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showVoyageKey, setShowVoyageKey] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [form, setForm] = useState({
    anthropic_api_key: '',
    voyage_api_key: '',
    model: 'claude-sonnet-4-6',
  })
  const [prompts, setPrompts] = useState<SystemPrompts>({})
  const [savingStage, setSavingStage] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/system-prompts').then(r => r.json()),
      fetch('/api/admin/users').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([settings, systemPrompts, adminCheck]) => {
      setForm({
        anthropic_api_key: settings.anthropic_api_key ?? '',
        voyage_api_key: settings.voyage_api_key ?? '',
        model: settings.model ?? 'claude-sonnet-4-6',
      })
      if (Array.isArray(systemPrompts)) {
        const map: SystemPrompts = {}
        for (const p of systemPrompts) map[p.stage] = p.content
        setPrompts(map)
      }
      // If admin/users endpoint returned data, user is admin
      setIsAdmin(Array.isArray(adminCheck))
    }).finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePrompt(stage: string) {
    setSavingStage(stage)
    try {
      const res = await fetch('/api/system-prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, content: prompts[stage] ?? '' }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Prompt saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save prompt')
    } finally {
      setSavingStage(null)
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="text-muted-foreground mt-0.5">Configure your AI provider, preferences, and generation prompts</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 mb-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Provider</CardTitle>
            <CardDescription>Your API keys are stored securely and never shared.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="anthropic_key">Anthropic API Key *</Label>
              <div className="relative">
                <Input
                  id="anthropic_key"
                  type={showAnthropicKey ? 'text' : 'password'}
                  placeholder="sk-ant-..."
                  value={form.anthropic_api_key}
                  onChange={e => setForm(f => ({ ...f, anthropic_api_key: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropicKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Required for all AI generation features</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Select value={form.model} onValueChange={v => setForm(f => ({ ...f, model: v }))}>
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vector Embeddings</CardTitle>
            <CardDescription>
              Used to semantically index your sources in Supabase. Get a free key at{' '}
              <a href="https://www.voyageai.com" target="_blank" rel="noopener noreferrer" className="underline">
                voyageai.com
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="voyage_key">Voyage AI API Key</Label>
              <div className="relative">
                <Input
                  id="voyage_key"
                  type={showVoyageKey ? 'text' : 'password'}
                  placeholder="pa-..."
                  value={form.voyage_api_key}
                  onChange={e => setForm(f => ({ ...f, voyage_api_key: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowVoyageKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showVoyageKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Optional — sources are saved without embeddings if not set
              </p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save settings'}
        </Button>
      </form>

      {/* System Prompts */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">System Prompts</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Default AI instructions used at each pipeline stage. Applied globally across all projects.
            {!isAdmin && <span className="text-amber-600 ml-1">— read-only (admin only)</span>}
          </p>
        </div>

        <Tabs defaultValue="charter">
          <TabsList className="mb-4">
            {STAGES.map(s => (
              <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>
            ))}
          </TabsList>

          {STAGES.map(s => (
            <TabsContent key={s.key} value={s.key}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{s.label} Prompt</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={prompts[s.key] ?? ''}
                    onChange={e => setPrompts(p => ({ ...p, [s.key]: e.target.value }))}
                    rows={8}
                    className="font-mono text-sm resize-y"
                    disabled={!isAdmin}
                    placeholder={isAdmin ? 'Enter system prompt...' : 'No prompt set'}
                  />
                  {isAdmin && (
                    <Button
                      size="sm"
                      onClick={() => handleSavePrompt(s.key)}
                      disabled={savingStage === s.key}
                    >
                      {savingStage === s.key ? 'Saving...' : `Save ${s.label} prompt`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
