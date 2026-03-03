'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DataSource } from '@/types'

interface Props {
  projectId: string
  onAdded: (source: DataSource) => void
}

export default function WebsiteSourceForm({ projectId, onAdded }: Props) {
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState('')

  function normalizeUrl(raw: string): string {
    const trimmed = raw.trim()
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)

    const normalized = normalizeUrl(url)

    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, type: 'website', url: normalized }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const source = await res.json()
      toast.success('Website scraped and added')
      onAdded(source)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to scrape website')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter a URL and Solomon will scrape the page content — useful for client websites, competitor pages, or reference docs.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="url">URL *</Label>
        <Input
          id="url"
          type="text"
          placeholder="example.com or https://example.com"
          value={url}
          onChange={e => setUrl(e.target.value)}
          required
          autoFocus
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading || !url.trim()}>
        {loading ? 'Scraping...' : 'Scrape & add'}
      </Button>
    </form>
  )
}
