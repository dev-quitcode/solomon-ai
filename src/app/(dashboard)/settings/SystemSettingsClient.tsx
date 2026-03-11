'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Eye, EyeOff } from 'lucide-react'

interface ModelOption {
  value: string
  label: string
  provider: string
}

const STAGES: { key: string; label: string; description: string }[] = [
  { key: 'charter',         label: 'Charter',        description: 'Guides AI when generating the Project Charter from source documents.' },
  { key: 'prd',             label: 'PRD',             description: 'Guides AI when generating the Product Requirements Document.' },
  { key: 'epics',           label: 'Epics',           description: 'Guides AI when breaking the PRD into Epics.' },
  { key: 'stories',         label: 'Stories',         description: 'Guides AI when generating User Stories from Epics.' },
  { key: 'domain_research', label: 'Domain Research', description: 'Guides the Domain Research Agent when synthesising industry knowledge.' },
]

type SystemPrompts = Record<string, string>

function KeyInput({
  id,
  value,
  placeholder,
  onChange,
}: {
  id: string
  value: string
  placeholder: string
  onChange: (v: string) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export default function SystemSettingsClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    anthropic_api_key: '',
    openai_api_key: '',
    gemini_api_key: '',
    voyage_api_key: '',
    model: 'anthropic:claude-sonnet-4-6',
  })
  const [models, setModels] = useState<ModelOption[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [prompts, setPrompts] = useState<SystemPrompts>({})
  const [savingStage, setSavingStage] = useState<string | null>(null)

  async function fetchModels() {
    setLoadingModels(true)
    try {
      const res = await fetch('/api/models')
      if (res.ok) setModels(await res.json())
    } finally {
      setLoadingModels(false)
    }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/system-prompts').then(r => r.json()),
    ]).then(([settings, systemPrompts]) => {
      setForm({
        anthropic_api_key: settings.anthropic_api_key ?? '',
        openai_api_key: settings.openai_api_key ?? '',
        gemini_api_key: settings.gemini_api_key ?? '',
        voyage_api_key: settings.voyage_api_key ?? '',
        model: settings.model ?? 'anthropic:claude-sonnet-4-6',
      })
      if (Array.isArray(systemPrompts)) {
        const map: SystemPrompts = {}
        for (const p of systemPrompts) map[p.stage] = p.content
        setPrompts(map)
      }
    }).finally(() => setLoading(false))
    fetchModels()
  }, [])

  async function handleSaveAI(e: React.FormEvent) {
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
      await fetchModels()
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

  const modelsByProvider = models.reduce<Record<string, ModelOption[]>>((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = []
    acc[m.provider].push(m)
    return acc
  }, {})

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="text-muted-foreground mt-0.5">Configure AI providers, models, and generation prompts</p>
      </div>

      <form onSubmit={handleSaveAI} className="space-y-6 mb-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Providers</CardTitle>
            <CardDescription>Add API keys to enable each provider. Your keys are stored securely and never shared.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="anthropic_key">Anthropic API Key</Label>
              <KeyInput
                id="anthropic_key"
                placeholder="sk-ant-..."
                value={form.anthropic_api_key}
                onChange={v => setForm(f => ({ ...f, anthropic_api_key: v }))}
              />
              <p className="text-xs text-muted-foreground">Claude models (Sonnet, Opus, Haiku)</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="openai_key">OpenAI API Key</Label>
              <KeyInput
                id="openai_key"
                placeholder="sk-..."
                value={form.openai_api_key}
                onChange={v => setForm(f => ({ ...f, openai_api_key: v }))}
              />
              <p className="text-xs text-muted-foreground">GPT-4o, o1, o3 and other OpenAI models</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gemini_key">Google Gemini API Key</Label>
              <KeyInput
                id="gemini_key"
                placeholder="AIza..."
                value={form.gemini_api_key}
                onChange={v => setForm(f => ({ ...f, gemini_api_key: v }))}
              />
              <p className="text-xs text-muted-foreground">Gemini 2.0 Flash, Pro and other Gemini models</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Active model</Label>
              <Select
                value={form.model}
                onValueChange={v => setForm(f => ({ ...f, model: v }))}
                disabled={loadingModels || models.length === 0}
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder={
                    loadingModels ? 'Loading models...' : 'Add an API key above to see models'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                    <SelectGroup key={provider}>
                      <SelectLabel>{provider}</SelectLabel>
                      {providerModels.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {models.length === 0 && !loadingModels && (
                <p className="text-xs text-muted-foreground">Add at least one API key and save to see available models.</p>
              )}
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
              <KeyInput
                id="voyage_key"
                placeholder="pa-..."
                value={form.voyage_api_key}
                onChange={v => setForm(f => ({ ...f, voyage_api_key: v }))}
              />
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
                    placeholder="Enter system prompt..."
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSavePrompt(s.key)}
                    disabled={savingStage === s.key}
                  >
                    {savingStage === s.key ? 'Saving...' : `Save ${s.label} prompt`}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
