import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Project } from '@/types'

const STATUS_LABELS: Record<Project['status'], string> = {
  setup: 'Setup',
  sources: 'Sources',
  charter: 'Charter',
  prd: 'PRD',
  epics: 'Epics',
  stories: 'Stories',
  approved: 'Approved',
}

const STATUS_COLORS: Record<Project['status'], string> = {
  setup: 'bg-zinc-100 text-zinc-600',
  sources: 'bg-blue-50 text-blue-600',
  charter: 'bg-purple-50 text-purple-600',
  prd: 'bg-indigo-50 text-indigo-600',
  epics: 'bg-amber-50 text-amber-600',
  stories: 'bg-orange-50 text-orange-600',
  approved: 'bg-green-50 text-green-600',
}

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/project/${project.id}`}>
      <Card className="h-full transition-shadow hover:shadow-md cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight line-clamp-2">{project.name}</h3>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[project.status]}`}>
              {STATUS_LABELS[project.status]}
            </span>
          </div>
          {project.client_name && (
            <p className="text-sm text-muted-foreground">{project.client_name}</p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="outline" className="text-xs capitalize">
              {project.type}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {project.mode === 'epics_and_stories' ? 'Epics + Stories' : 'Stories only'}
            </Badge>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
