'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles, Edit2, Save, X, CheckCircle, RefreshCw, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import MarkdownViewer from '@/components/charter/MarkdownViewer'
import ExportButton from '@/components/ExportButton'
import ClarifyPanel from '@/components/ClarifyPanel'
import type { PRD } from '@/types'

export default function PRDPage() {
  const { id } = useParams<{ id: string }>()
  const [prd, setPrd] = useState<PRD | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [clarifying, setClarifying] = useState(false)

  useEffect(() => {
    fetch(`/api/prd?project_id=${id}`)
      .then(r => r.json())
      .then(data => setPrd(data))
      .finally(() => setLoading(false))
  }, [id])

  async function handleGenerate() {
    setGenerating(true)
    toast.loading('Generating PRD...', { id: 'prd-gen' })
    try {
      const res = await fetch('/api/ai/prd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: id }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setPrd(await res.json())
      toast.success('PRD generated', { id: 'prd-gen' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed', { id: 'prd-gen' })
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!prd) return
    setSaving(true)
    try {
      const res = await fetch(`/api/prd/${prd.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setPrd(await res.json())
      setEditing(false)
      toast.success('PRD saved')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function handleClarify(clarification: string) {
    setClarifying(true)
    toast.loading('Refining PRD...', { id: 'prd-clarify' })
    try {
      const res = await fetch('/api/ai/prd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: id, clarification }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await res.json()
      setPrd(updated)
      toast.success('PRD refined', { id: 'prd-clarify' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Clarification failed', { id: 'prd-clarify' })
    } finally {
      setClarifying(false)
    }
  }

  async function handleApprove() {
    if (!prd) return
    setApproving(true)
    try {
      const res = await fetch(`/api/prd/${prd.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setPrd(await res.json())
      toast.success('PRD approved — Epics generation unlocked')
    } catch { toast.error('Failed to approve') }
    finally { setApproving(false) }
  }

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Loading...</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Product Requirements Document</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Generated from Charter + all sources</p>
        </div>
        <div className="flex items-center gap-2">
          {prd && (
            <>
              <Badge variant="outline" className="text-xs">v{prd.version}</Badge>
              <Badge className={prd.status === 'approved'
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-amber-100 text-amber-700 border-amber-200'}>
                {prd.status === 'approved' ? 'Approved' : 'Draft'}
              </Badge>
            </>
          )}
          {prd && !editing && (
            <>
              <ExportButton title="PRD" content={prd.content ?? ''} />
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
                <RefreshCw className="h-3.5 w-3.5" />Regenerate
              </Button>
            </>
          )}
          {!prd && (
            <Button onClick={handleGenerate} disabled={generating}>
              <Sparkles className="h-4 w-4" />
              {generating ? 'Generating...' : 'Generate PRD'}
            </Button>
          )}
        </div>
      </div>

      {!prd && !generating && (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border-2 border-dashed">
          <div className="rounded-full bg-muted p-4 mb-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">No PRD yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-6 max-w-md">
            Approve the Project Charter first, then generate the PRD. It will be informed by the charter and all source documents.
          </p>
          <Button onClick={handleGenerate} disabled={generating}>
            <Sparkles className="h-4 w-4" />Generate PRD
          </Button>
        </div>
      )}

      {generating && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin mb-4" />
          <p className="text-muted-foreground">Analysing charter and sources...</p>
        </div>
      )}

      {prd && !generating && (
        <div className="space-y-4">
          {editing ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-3.5 w-3.5" />{saving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" />Cancel
              </Button>
            </div>
          ) : prd.status === 'approved' ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-700">PRD approved. Generate Epics or User Stories next.</p>
              <Button size="sm" variant="ghost" className="ml-auto text-xs" onClick={() => { setEditContent(prd.content ?? ''); setEditing(true) }}>Edit anyway</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border">
              <Button size="sm" variant="outline" onClick={() => { setEditContent(prd.content ?? ''); setEditing(true) }}>
                <Edit2 className="h-3.5 w-3.5" />Edit
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleApprove} disabled={approving}>
                <CheckCircle className="h-3.5 w-3.5" />{approving ? 'Approving...' : 'Approve PRD'}
              </Button>
              <p className="text-xs text-muted-foreground ml-1">Approving unlocks Epics generation</p>
            </div>
          )}
          {!editing && (
            <ClarifyPanel
              onApply={handleClarify}
              applying={clarifying}
              placeholder="e.g. Expand the non-functional requirements. Add more user personas. Make the functional requirements more detailed with specific use cases."
            />
          )}

          <div className="rounded-xl border bg-card p-8">
            {editing ? (
              <Textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                className="min-h-[600px] font-mono text-sm resize-none border-0 p-0 shadow-none focus-visible:ring-0" />
            ) : (
              <MarkdownViewer content={prd.content ?? ''} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
