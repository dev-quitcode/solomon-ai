import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Database, FileText, BookOpen, Layers, ListChecks, ArrowRight } from 'lucide-react'
import type { Project } from '@/types'

const PIPELINE_STEPS = [
  { key: 'sources', label: 'Data Sources', icon: Database, href: 'sources', description: 'Add documents, URLs, and context' },
  { key: 'charter', label: 'Project Charter', icon: FileText, href: 'charter', description: 'Formal project initiation document' },
  { key: 'prd', label: 'PRD', icon: BookOpen, href: 'prd', description: 'Product Requirements Document' },
  { key: 'epics', label: 'Epics', icon: Layers, href: 'epics', description: 'High-level feature groups' },
  { key: 'stories', label: 'User Stories', icon: ListChecks, href: 'stories', description: 'Detailed requirements' },
] as const

const STATUS_ORDER = ['setup', 'sources', 'charter', 'prd', 'epics', 'stories', 'approved']

function getStepStatus(stepKey: string, projectStatus: Project['status']) {
  const stepIdx = STATUS_ORDER.indexOf(stepKey)
  const currentIdx = STATUS_ORDER.indexOf(projectStatus)
  if (currentIdx > stepIdx) return 'complete'
  if (currentIdx === stepIdx) return 'current'
  return 'locked'
}

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) notFound()

  const p = project as Project

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{p.name}</h1>
            {p.client_name && (
              <p className="text-muted-foreground mt-0.5">{p.client_name}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="capitalize">{p.type}</Badge>
            <Badge variant="outline">
              {p.mode === 'epics_and_stories' ? 'Epics + Stories' : 'Stories only'}
            </Badge>
          </div>
        </div>
        {p.industry && (
          <p className="text-sm text-muted-foreground mt-2">Industry: {p.industry}</p>
        )}
      </div>

      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Pipeline
      </h2>

      <div className="space-y-3">
        {PIPELINE_STEPS.filter(step =>
          step.key !== 'epics' || p.mode === 'epics_and_stories'
        ).map(step => {
          const status = getStepStatus(step.key, p.status)
          return (
            <Card
              key={step.key}
              className={status === 'locked' ? 'opacity-50' : ''}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                  status === 'complete'
                    ? 'border-green-500 bg-green-50 text-green-600'
                    : status === 'current'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-muted bg-muted text-muted-foreground'
                }`}>
                  <step.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {status !== 'locked' && (
                  <Button asChild size="sm" variant={status === 'current' ? 'default' : 'ghost'}>
                    <Link href={`/project/${id}/${step.href}`}>
                      {status === 'current' ? 'Continue' : 'View'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
