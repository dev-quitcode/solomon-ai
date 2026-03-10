'use client'

import { useState } from 'react'
import { Plus, FileText, Globe, AlignLeft, MessageSquare, Phone, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import TextSourceForm from './TextSourceForm'
import CallTranscriptForm from './CallTranscriptForm'
import FileUploadForm from './FileUploadForm'
import WebsiteSourceForm from './WebsiteSourceForm'
import QuestionnaireForm from './QuestionnaireForm'
import type { DataSource } from '@/types'

type SourceType = 'file' | 'website' | 'text' | 'questionnaire' | 'call_transcript'

const SOURCE_TYPES: { value: SourceType; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'file',           label: 'File',             description: 'PDF, JSON schema, or text file', icon: FileText },
  { value: 'call_transcript', label: 'Call Transcript', description: 'Upload file or paste text',    icon: Phone },
  { value: 'website',        label: 'Website',          description: 'Scrape a URL',                icon: Globe },
  { value: 'text',          label: 'Text',        description: 'Paste notes or a transcript',    icon: AlignLeft },
  { value: 'questionnaire', label: 'Interview',   description: 'Structured BA questionnaire',    icon: MessageSquare },
]

const DIALOG_TITLES: Record<SourceType, string> = {
  file:             'Upload file',
  call_transcript:  'Call transcript',
  website:          'Add website',
  text:             'Paste text',
  questionnaire:    'BA questionnaire',
}

interface Props {
  projectId: string
  onAdded: (source: DataSource) => void
}

export default function AddSourceDialog({ projectId, onAdded }: Props) {
  const [activeType, setActiveType] = useState<SourceType | null>(null)

  function handleAdded(source: DataSource) {
    onAdded(source)
    setActiveType(null)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" />
            Add source
            <ChevronDown className="h-3.5 w-3.5 ml-0.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {SOURCE_TYPES.map(t => (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setActiveType(t.value)}
              className="flex items-start gap-2.5 py-2.5 cursor-pointer"
            >
              <t.icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium leading-none">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={activeType !== null} onOpenChange={open => { if (!open) setActiveType(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{activeType ? DIALOG_TITLES[activeType] : ''}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {activeType === 'file'             && <FileUploadForm      projectId={projectId} onAdded={handleAdded} />}
          {activeType === 'call_transcript'  && <CallTranscriptForm  projectId={projectId} onAdded={handleAdded} />}
            {activeType === 'website'       && <WebsiteSourceForm projectId={projectId} onAdded={handleAdded} />}
            {activeType === 'text'          && <TextSourceForm    projectId={projectId} onAdded={handleAdded} />}
            {activeType === 'questionnaire' && <QuestionnaireForm projectId={projectId} onAdded={handleAdded} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
