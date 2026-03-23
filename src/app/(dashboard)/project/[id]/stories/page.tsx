'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles, Trash2, ListChecks, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { UserStory, Epic, Priority } from '@/types'

const PRIORITY_COLORS: Record<Priority, string> = {
  must: 'bg-red-50 text-red-700 border-red-200',
  should: 'bg-amber-50 text-amber-700 border-amber-200',
  could: 'bg-blue-50 text-blue-700 border-blue-200',
  wont: 'bg-zinc-50 text-zinc-500 border-zinc-200',
}

const EFFORT_COLORS: Record<string, string> = {
  S: 'bg-green-50 text-green-700', M: 'bg-blue-50 text-blue-700',
  L: 'bg-amber-50 text-amber-700', XL: 'bg-red-50 text-red-700',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  in_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
}

export default function StoriesPage() {
  const { id } = useParams<{ id: string }>()
  const [stories, setStories] = useState<UserStory[]>([])
  const [epics, setEpics] = useState<Epic[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedEpicId, setSelectedEpicId] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/stories?project_id=${id}`).then(r => r.json()),
      fetch(`/api/epics?project_id=${id}`).then(r => r.json()),
    ]).then(([s, e]) => {
      setStories(Array.isArray(s) ? s : [])
      setEpics(Array.isArray(e) ? e : [])
    }).finally(() => setLoading(false))
  }, [id])

  async function handleGenerate() {
    setGenerating(true)
    toast.loading('Generating stories...', { id: 'stories-gen' })
    try {
      const res = await fetch('/api/ai/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: id,
          epic_id: selectedEpicId !== 'all' ? selectedEpicId : undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const newStories = await res.json()
      setStories(prev => [...prev, ...newStories])
      toast.success(`${newStories.length} stories generated`, { id: 'stories-gen' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed', { id: 'stories-gen' })
    } finally {
      setGenerating(false)
    }
  }

  async function updateStory(storyId: string, patch: Partial<UserStory>) {
    const res = await fetch(`/api/stories/${storyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const updated = await res.json()
      setStories(prev => prev.map(s => s.id === storyId ? updated : s))
      if ('githubSyncError' in updated) {
        if (updated.githubSyncError === null) {
          toast.success('Synced to GitHub')
        } else {
          toast.error(`GitHub sync failed: ${updated.githubSyncError}`)
        }
      }
    }
  }

  async function deleteStory(storyId: string) {
    const res = await fetch(`/api/stories/${storyId}`, { method: 'DELETE' })
    if (res.ok) {
      setStories(prev => prev.filter(s => s.id !== storyId))
      toast.success('Story deleted')
    }
  }

  const filteredStories = selectedEpicId === 'all'
    ? stories
    : stories.filter(s => s.epic_id === selectedEpicId)

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Loading...</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Stories</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{stories.length} stor{stories.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <div className="flex items-center gap-2">
          {epics.length > 0 && (
            <Select value={selectedEpicId} onValueChange={setSelectedEpicId}>
              <SelectTrigger className="w-48 h-9 text-sm">
                <SelectValue placeholder="All epics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All epics</SelectItem>
                {epics.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.code}: {e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleGenerate} disabled={generating}>
            <Sparkles className="h-4 w-4" />
            {generating ? 'Generating...' : stories.length ? 'Generate more' : 'Generate Stories'}
          </Button>
        </div>
      </div>

      {!stories.length && !generating && (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border-2 border-dashed">
          <div className="rounded-full bg-muted p-4 mb-4">
            <ListChecks className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">No stories yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-6 max-w-md">
            Generate user stories from the PRD. Select a specific Epic first to generate stories for that feature area.
          </p>
          <Button onClick={handleGenerate} disabled={generating}>
            <Sparkles className="h-4 w-4" />Generate Stories
          </Button>
        </div>
      )}

      {generating && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground animate-pulse mb-4" />
          <p className="text-muted-foreground">Writing user stories...</p>
        </div>
      )}

      <div className="space-y-2">
        {filteredStories.map(story => {
          const expanded = expandedId === story.id
          const epicName = epics.find(e => e.id === story.epic_id)?.title
          return (
            <div key={story.id} className="rounded-xl border bg-card overflow-hidden">
              <div
                className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-muted/20"
                onClick={() => setExpandedId(expanded ? null : story.id)}
              >
                <span className="text-xs font-mono text-muted-foreground shrink-0 w-16">{story.code}</span>
                <p className="flex-1 text-sm font-medium truncate">{story.title}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  {story.effort_estimate && (
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${EFFORT_COLORS[story.effort_estimate]}`}>
                      {story.effort_estimate}
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${PRIORITY_COLORS[story.priority]}`}>
                    {story.priority}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[story.status]}`}>
                    {story.status.replace('_', ' ')}
                  </span>
                  {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {expanded && (
                <div className="px-5 pb-4 border-t bg-muted/10">
                  {epicName && (
                    <p className="text-xs text-muted-foreground mt-3 mb-4">Epic: {epicName}</p>
                  )}
                  <div className="space-y-2 mb-4">
                    <p className="text-sm"><span className="text-muted-foreground">As a</span> <strong>{story.as_a}</strong></p>
                    <p className="text-sm"><span className="text-muted-foreground">I want</span> {story.i_want}</p>
                    <p className="text-sm"><span className="text-muted-foreground">So that</span> {story.so_that}</p>
                  </div>

                  {story.acceptance_criteria?.length > 0 && (
                    <div className="rounded-lg bg-background border p-3 mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Acceptance criteria</p>
                      <ul className="space-y-1">
                        {story.acceptance_criteria.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Select value={story.priority} onValueChange={v => updateStory(story.id, { priority: v as Priority })}>
                      <SelectTrigger className={`h-7 text-xs border px-2 w-auto ${PRIORITY_COLORS[story.priority]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="must">Must</SelectItem>
                        <SelectItem value="should">Should</SelectItem>
                        <SelectItem value="could">Could</SelectItem>
                        <SelectItem value="wont">Won&apos;t</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={story.status} onValueChange={v => updateStory(story.id, { status: v as UserStory['status'] })}>
                      <SelectTrigger className={`h-7 text-xs border-0 px-2 w-auto rounded-full ${STATUS_COLORS[story.status]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" className="ml-auto h-7 text-muted-foreground hover:text-destructive text-xs gap-1"
                      onClick={() => deleteStory(story.id)}>
                      <Trash2 className="h-3 w-3" />Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
