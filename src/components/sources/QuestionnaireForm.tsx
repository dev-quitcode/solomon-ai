'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { DataSource } from '@/types'

const QUESTIONS = [
  { key: 'business_problem', label: 'Business problem / opportunity', placeholder: 'What problem are we solving or what opportunity are we pursuing?' },
  { key: 'target_users', label: 'Target users', placeholder: 'Who will use this system? Describe their role, technical level, context.' },
  { key: 'current_process', label: 'Current process', placeholder: 'How is this done today? Manual steps, tools used, workarounds...' },
  { key: 'pain_points', label: 'Top 3 pain points', placeholder: 'What are the biggest frustrations with the current approach?' },
  { key: 'desired_outcome', label: 'Desired outcome', placeholder: 'What does success look like? What should users be able to do?' },
  { key: 'key_features', label: 'Must-have features', placeholder: 'What capabilities are absolutely critical for v1?' },
  { key: 'technical_constraints', label: 'Technical constraints', placeholder: 'Any platform requirements, integrations, security needs, or tech stack preferences?' },
  { key: 'timeline', label: 'Timeline', placeholder: 'Expected launch date or key milestones?' },
  { key: 'budget', label: 'Budget / resources', placeholder: 'Team size, budget range, or resource constraints?' },
  { key: 'stakeholders', label: 'Key stakeholders', placeholder: 'Who are the decision makers? Who needs to approve requirements?' },
]

interface Props {
  projectId: string
  onAdded: (source: DataSource) => void
}

export default function QuestionnaireForm({ projectId, onAdded }: Props) {
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const filledCount = Object.values(answers).filter(v => v.trim()).length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (filledCount === 0) return
    setLoading(true)

    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          type: 'questionnaire',
          title: 'Project Discovery Questionnaire',
          answers,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const source = await res.json()
      toast.success('Questionnaire saved')
      onAdded(source)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save questionnaire')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
      <p className="text-sm text-muted-foreground">
        Answer as many questions as you can. All fields are optional — partial answers are fine.
      </p>

      {QUESTIONS.map(q => (
        <div key={q.key} className="space-y-1.5">
          <Label htmlFor={q.key} className="font-medium">{q.label}</Label>
          <Textarea
            id={q.key}
            placeholder={q.placeholder}
            value={answers[q.key] ?? ''}
            onChange={e => setAnswers(a => ({ ...a, [q.key]: e.target.value }))}
            rows={3}
            className="resize-none"
          />
        </div>
      ))}

      <Button
        type="submit"
        className="w-full sticky bottom-0"
        disabled={loading || filledCount === 0}
      >
        {loading ? 'Saving...' : `Save questionnaire (${filledCount}/${QUESTIONS.length} answered)`}
      </Button>
    </form>
  )
}
