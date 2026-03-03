'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Sparkles, Edit2, Save, X, CheckCircle, RefreshCw, FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import MarkdownViewer from '@/components/charter/MarkdownViewer'
import ExportButton from '@/components/ExportButton'
import ClarifyPanel from '@/components/ClarifyPanel'
import type { ProjectCharter } from '@/types'

export default function CharterPage() {
  const { id } = useParams<{ id: string }>()
  const [charter, setCharter] = useState<ProjectCharter | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [clarifying, setClarifying] = useState(false)

  useEffect(() => {
    fetch(`/api/charter?project_id=${id}`)
      .then(r => r.json())
      .then(data => setCharter(data))
      .finally(() => setLoading(false))
  }, [id])

  async function handleGenerate() {
    setGenerating(true)
    toast.loading('Generating charter...', { id: 'charter-gen' })
    try {
      const res = await fetch('/api/ai/charter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: id }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const newCharter = await res.json()
      setCharter(newCharter)
      toast.success('Charter generated', { id: 'charter-gen' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed', { id: 'charter-gen' })
    } finally {
      setGenerating(false)
    }
  }

  function startEdit() {
    setEditContent(charter?.content ?? '')
    setEditing(true)
  }

  async function handleSave() {
    if (!charter) return
    setSaving(true)
    try {
      const res = await fetch(`/api/charter/${charter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await res.json()
      setCharter(updated)
      setEditing(false)
      toast.success('Charter saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleClarify(clarification: string) {
    setClarifying(true)
    toast.loading('Refining charter...', { id: 'charter-clarify' })
    try {
      const res = await fetch('/api/ai/charter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: id, clarification }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await res.json()
      setCharter(updated)
      toast.success('Charter refined', { id: 'charter-clarify' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Clarification failed', { id: 'charter-clarify' })
    } finally {
      setClarifying(false)
    }
  }

  async function handleApprove() {
    if (!charter) return
    setApproving(true)
    try {
      const res = await fetch(`/api/charter/${charter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await res.json()
      setCharter(updated)
      toast.success('Charter approved — PRD is now unlocked')
    } catch {
      toast.error('Failed to approve')
    } finally {
      setApproving(false)
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Loading...</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Project Charter</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Formal project initiation document
          </p>
        </div>
        <div className="flex items-center gap-2">
          {charter && (
            <>
              <Badge variant="outline" className="text-xs">v{charter.version}</Badge>
              <Badge className={charter.status === 'approved'
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-amber-100 text-amber-700 border-amber-200'
              }>
                {charter.status === 'approved' ? 'Approved' : 'Draft'}
              </Badge>
            </>
          )}
          {charter && !editing && (
            <>
              <ExportButton title="Project Charter" content={charter.content ?? ''} />
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
            </>
          )}
          {!charter && (
            <Button onClick={handleGenerate} disabled={generating}>
              <Sparkles className="h-4 w-4" />
              {generating ? 'Generating...' : 'Generate Charter'}
            </Button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!charter && !generating && (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border-2 border-dashed">
          <div className="rounded-full bg-muted p-4 mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">No charter yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-6 max-w-md">
            Add your data sources first, then generate the charter. The AI will use all your sources to create a comprehensive project initiation document.
          </p>
          <Button onClick={handleGenerate} disabled={generating}>
            <Sparkles className="h-4 w-4" />
            Generate Charter
          </Button>
        </div>
      )}

      {generating && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin mb-4" />
          <p className="text-muted-foreground">Analysing sources and generating charter...</p>
        </div>
      )}

      {/* Charter content */}
      {charter && !generating && (
        <div className="space-y-4">
          {/* Edit / Approve toolbar */}
          {editing ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          ) : charter.status === 'approved' ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-700">
                Charter approved. You can now generate the PRD.
              </p>
              <Button size="sm" variant="ghost" className="ml-auto text-xs" onClick={startEdit}>
                Edit anyway
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border">
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApprove}
                disabled={approving}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {approving ? 'Approving...' : 'Approve Charter'}
              </Button>
              <p className="text-xs text-muted-foreground ml-1">
                Approving unlocks PRD generation
              </p>
            </div>
          )}

          {/* Clarify */}
          {!editing && (
            <ClarifyPanel
              onApply={handleClarify}
              applying={clarifying}
              placeholder="e.g. Expand the risks section with more detail. Add a communication plan. Make the success criteria more specific with measurable KPIs."
            />
          )}

          {/* Content */}
          <div className="rounded-xl border bg-card p-8">
            {editing ? (
              <Textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="min-h-[600px] font-mono text-sm resize-none border-0 p-0 shadow-none focus-visible:ring-0"
                placeholder="Charter content..."
              />
            ) : (
              <MarkdownViewer content={charter.content ?? ''} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
