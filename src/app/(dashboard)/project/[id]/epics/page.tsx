'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles, Trash2, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ExportButton from '@/components/ExportButton'
import ClarifyPanel from '@/components/ClarifyPanel'
import type { Epic, Priority } from '@/types'

function epicsToMarkdown(epics: Epic[]): string {
  return epics.map(epic => [
    `## ${epic.code}: ${epic.title}`,
    `**Priority:** ${epic.priority.charAt(0).toUpperCase() + epic.priority.slice(1)} | **Status:** ${epic.status.replace('_', ' ')}`,
    '',
    epic.description ?? '',
    epic.acceptance_criteria ? `\n**Acceptance Criteria**\n${epic.acceptance_criteria}` : '',
  ].filter(l => l !== undefined).join('\n')).join('\n\n---\n\n')
}

const PRIORITY_COLORS: Record<Priority, string> = {
  must: 'bg-red-50 text-red-700 border-red-200',
  should: 'bg-amber-50 text-amber-700 border-amber-200',
  could: 'bg-blue-50 text-blue-700 border-blue-200',
  wont: 'bg-zinc-50 text-zinc-500 border-zinc-200',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  in_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
}

export default function EpicsPage() {
  const { id } = useParams<{ id: string }>()
  const [epics, setEpics] = useState<Epic[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [clarifying, setClarifying] = useState(false)

  useEffect(() => {
    fetch(`/api/epics?project_id=${id}`)
      .then(r => r.json())
      .then(data => setEpics(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [id])

  async function handleGenerate() {
    setGenerating(true)
    toast.loading('Generating epics...', { id: 'epics-gen' })
    try {
      const res = await fetch('/api/ai/epics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: id }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const newEpics = await res.json()
      setEpics(prev => [...prev, ...newEpics])
      toast.success(`${newEpics.length} epics generated`, { id: 'epics-gen' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed', { id: 'epics-gen' })
    } finally {
      setGenerating(false)
    }
  }

  async function handleClarify(clarification: string) {
    setClarifying(true)
    toast.loading('Refining epics...', { id: 'epics-clarify' })
    try {
      const res = await fetch('/api/ai/epics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: id, clarification }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const refined = await res.json()
      setEpics(refined)
      toast.success('Epics refined', { id: 'epics-clarify' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Clarification failed', { id: 'epics-clarify' })
    } finally {
      setClarifying(false)
    }
  }

  async function updateEpic(epicId: string, patch: Partial<Epic>) {
    const res = await fetch(`/api/epics/${epicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const updated = await res.json()
      setEpics(prev => prev.map(e => e.id === epicId ? updated : e))
    }
  }

  async function deleteEpic(epicId: string) {
    const res = await fetch(`/api/epics/${epicId}`, { method: 'DELETE' })
    if (res.ok) {
      setEpics(prev => prev.filter(e => e.id !== epicId))
      toast.success('Epic deleted')
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Loading...</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Epics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{epics.length} epic{epics.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {epics.length > 0 && (
            <ExportButton title="Epics" content={epicsToMarkdown(epics)} />
          )}
          <Button onClick={handleGenerate} disabled={generating}>
            <Sparkles className="h-4 w-4" />
            {generating ? 'Generating...' : epics.length ? 'Generate more' : 'Generate Epics'}
          </Button>
        </div>
      </div>

      {!epics.length && !generating && (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border-2 border-dashed">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Layers className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">No epics yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-6 max-w-md">
            Approve the PRD first, then generate epics. The AI groups requirements into logical feature areas.
          </p>
          <Button onClick={handleGenerate} disabled={generating}>
            <Sparkles className="h-4 w-4" />Generate Epics
          </Button>
        </div>
      )}

      {generating && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground animate-pulse mb-4" />
          <p className="text-muted-foreground">Grouping requirements into epics...</p>
        </div>
      )}

      {epics.length > 0 && (
        <div className="mb-4">
          <ClarifyPanel
            onApply={handleClarify}
            applying={clarifying}
            placeholder="e.g. Split the authentication epic into two. Add an admin panel epic. Make the acceptance criteria more specific for the reporting epic."
          />
        </div>
      )}

      <div className="space-y-3">
        {epics.map(epic => (
          <div key={epic.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-muted-foreground shrink-0">{epic.code}</span>
                <h3 className="font-semibold truncate">{epic.title}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select
                  value={epic.priority}
                  onValueChange={v => updateEpic(epic.id, { priority: v as Priority })}
                >
                  <SelectTrigger className={`h-7 text-xs border px-2 w-auto ${PRIORITY_COLORS[epic.priority]}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="must">Must</SelectItem>
                    <SelectItem value="should">Should</SelectItem>
                    <SelectItem value="could">Could</SelectItem>
                    <SelectItem value="wont">Won&apos;t</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={epic.status}
                  onValueChange={v => updateEpic(epic.id, { status: v as Epic['status'] })}
                >
                  <SelectTrigger className={`h-7 text-xs border-0 px-2 w-auto rounded-full ${STATUS_COLORS[epic.status]}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteEpic(epic.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {epic.description && (
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{epic.description}</p>
            )}

            {epic.acceptance_criteria && (
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Acceptance criteria</p>
                <p className="text-xs leading-relaxed whitespace-pre-line">{epic.acceptance_criteria}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
