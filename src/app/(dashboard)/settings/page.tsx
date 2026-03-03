'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, EyeOff } from 'lucide-react'

const MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (Most capable)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fastest)' },
]

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showVoyageKey, setShowVoyageKey] = useState(false)
  const [form, setForm] = useState({
    anthropic_api_key: '',
    voyage_api_key: '',
    model: 'claude-sonnet-4-6',
  })

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setForm({
          anthropic_api_key: data.anthropic_api_key ?? '',
          voyage_api_key: data.voyage_api_key ?? '',
          model: data.model ?? 'claude-sonnet-4-6',
        })
      })
      .finally(() => setLoading(false))
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

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-0.5">Configure your AI provider and preferences</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Provider</CardTitle>
            <CardDescription>
              Your API keys are stored securely and never shared.
            </CardDescription>
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
    </div>
  )
}
