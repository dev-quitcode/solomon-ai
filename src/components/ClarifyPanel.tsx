'use client'

import { useState } from 'react'
import { MessageSquarePlus, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  onApply: (clarification: string) => Promise<void>
  applying: boolean
  placeholder?: string
}

export default function ClarifyPanel({ onApply, applying, placeholder }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')

  async function handleApply() {
    if (!text.trim()) return
    await onApply(text.trim())
    setText('')
    setExpanded(false)
  }

  return (
    <div className="rounded-lg border bg-muted/20">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquarePlus className="h-4 w-4 shrink-0" />
        <span className="font-medium text-foreground">Clarify with AI</span>
        <span className="text-xs opacity-60 hidden sm:inline">— add instructions to refine this document</span>
        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 ml-auto shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 ml-auto shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t pt-3">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={placeholder ?? 'e.g. Add more detail to the technical constraints. Focus on GDPR compliance. Make the success criteria more specific with measurable KPIs.'}
            rows={3}
            className="text-sm resize-none"
            disabled={applying}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleApply} disabled={applying || !text.trim()}>
              <Sparkles className="h-3.5 w-3.5" />
              {applying ? 'Applying...' : 'Apply'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExpanded(false)} disabled={applying}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
