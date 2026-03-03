'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import AddSourceDialog from '@/components/sources/AddSourceDialog'
import SourcesList from '@/components/sources/SourcesList'
import DomainResearchPanel from '@/components/sources/DomainResearchPanel'
import type { DataSource } from '@/types'

interface ProjectMeta {
  industry: string | null
  client_name: string | null
}

export default function SourcesPage() {
  const { id } = useParams<{ id: string }>()
  const [sources, setSources] = useState<DataSource[]>([])
  const [project, setProject] = useState<ProjectMeta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/sources?project_id=${id}`).then(r => r.json()),
      fetch(`/api/projects/${id}`).then(r => r.json()),
    ]).then(([srcs, proj]) => {
      setSources(Array.isArray(srcs) ? srcs : [])
      setProject(proj)
    }).finally(() => setLoading(false))
  }, [id])

  function handleAdded(source: DataSource) {
    setSources(prev => [source, ...prev])
  }

  function handleDeleted(sourceId: string) {
    setSources(prev => prev.filter(s => s.id !== sourceId))
  }

  function handleToggled(sourceId: string, enabled: boolean) {
    setSources(prev => prev.map(s => s.id === sourceId ? { ...s, enabled } : s))
  }

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Loading...</div>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Data Sources</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Add everything you know about this project — the more context, the better the output
          </p>
        </div>
        <AddSourceDialog projectId={id} onAdded={handleAdded} />
      </div>

      <div className="mb-6">
        <DomainResearchPanel
          projectId={id}
          industry={project?.industry ?? null}
          clientName={project?.client_name ?? null}
          onAdded={handleAdded}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Sources ({sources.length})
          </h2>
        </div>
        <SourcesList sources={sources} onDeleted={handleDeleted} onToggled={handleToggled} />
      </div>
    </div>
  )
}
