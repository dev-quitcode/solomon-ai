'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Brain, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import type { DataSource } from '@/types'

interface Props {
  projectId: string
  industry: string | null
  clientName: string | null
  onAdded: (source: DataSource) => void
}

export default function DomainResearchPanel({ projectId, industry, clientName, onAdded }: Props) {
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [industryInput, setIndustryInput] = useState(industry ?? '')
  const [companyInput, setCompanyInput] = useState(clientName ?? '')
  const [focus, setFocus] = useState('')

  async function handleResearch() {
    setLoading(true)
    toast.loading('Researching domain...', { id: 'domain-research' })

    try {
      const res = await fetch('/api/ai/domain-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          industry: industryInput,
          company: companyInput,
          focus,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }

      const source = await res.json()
      toast.success('Domain research complete', { id: 'domain-research' })
      onAdded(source)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Research failed', { id: 'domain-research' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-dashed">
      <CardContent className="py-4 space-y-0">
        {/* Header row */}
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
            <Brain className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Domain Research Agent</p>
            <p className="text-xs text-muted-foreground">
              AI web search — industry trends, key players, challenges, regulations
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(v => !v)}
              className="text-muted-foreground h-8 px-2"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? 'Less' : 'Configure'}
            </Button>
            <Button
              size="sm"
              onClick={handleResearch}
              disabled={loading}
              className="shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {loading ? 'Researching...' : 'Research'}
            </Button>
          </div>
        </div>

        {/* Editable fields */}
        {expanded && (
          <div className="pt-4 space-y-3 border-t mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Industry</Label>
                <Input
                  value={industryInput}
                  onChange={e => setIndustryInput(e.target.value)}
                  placeholder="e.g. Healthcare, Fintech"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Company / Client</Label>
                <Input
                  value={companyInput}
                  onChange={e => setCompanyInput(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Additional focus <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                value={focus}
                onChange={e => setFocus(e.target.value)}
                placeholder="e.g. Focus on GDPR compliance and data privacy, or European market specifically"
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
