'use client'

import { useState } from 'react'
import { Download, FileText, FileType } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { downloadAsPDF, downloadAsDocx } from '@/lib/utils/export'

interface Props {
  title: string
  content: string
}

export default function ExportButton({ title, content }: Props) {
  const [exporting, setExporting] = useState(false)

  async function handleExport(format: 'pdf' | 'docx') {
    setExporting(true)
    try {
      if (format === 'pdf') {
        downloadAsPDF(title, content)
      } else {
        await downloadAsDocx(title, content)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2 text-red-500" />
          Download as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('docx')}>
          <FileType className="h-4 w-4 mr-2 text-blue-500" />
          Download as DOCX
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
