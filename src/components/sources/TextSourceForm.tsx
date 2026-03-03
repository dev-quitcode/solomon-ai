'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DataSource, SourceType } from '@/types'

const TEXT_TYPES: { value: SourceType; label: string }[] = [
  { value: 'text', label: 'General notes' },
  { value: 'job_description_initial', label: 'Initial job brief' },
  { value: 'job_description_detailed', label: 'Detailed job description' },
  { value: 'call_transcript', label: 'Call transcript' },
]

interface Props {
  projectId: string
  onAdded: (source: DataSource) => void
}

export default function TextSourceForm({ projectId, onAdded }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', type: 'text' as SourceType })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.content.trim()) return
    setLoading(true)

    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, ...form }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const source = await res.json()
      toast.success('Source added')
      onAdded(source)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as SourceType }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEXT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">Title (optional)</Label>
        <Input
          id="title"
          placeholder="e.g. Initial client brief"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="content">Content *</Label>
        <Textarea
          id="content"
          placeholder="Paste your text here..."
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          rows={8}
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading || !form.content.trim()}>
        {loading ? 'Adding...' : 'Add source'}
      </Button>
    </form>
  )
}
