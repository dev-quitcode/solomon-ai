import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  type IParagraphOptions,
} from 'docx'

// ─── PDF via browser print window ────────────────────────────────────────────

const inlineFormat = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')

const isTableRow = (line: string) => line.startsWith('|') && line.endsWith('|')
const isSeparatorRow = (line: string) => /^\|[\s|:-]+\|$/.test(line)

function parseTableRow(line: string): string[] {
  return line.slice(1, -1).split('|').map(c => c.trim())
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split('\n')
  const html: string[] = []
  let inList = false
  let inTable = false
  let tableHeaderDone = false

  const closeList = () => {
    if (inList) { html.push('</ul>'); inList = false }
  }
  const closeTable = () => {
    if (inTable) { html.push('</tbody></table>'); inTable = false; tableHeaderDone = false }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd()

    // Table handling
    if (isTableRow(line)) {
      // Check if next line is separator (means current line is header)
      const next = lines[i + 1]?.trimEnd() ?? ''
      if (!inTable && isSeparatorRow(next)) {
        closeList()
        html.push('<table><thead><tr>')
        for (const cell of parseTableRow(line))
          html.push(`<th>${inlineFormat(cell)}</th>`)
        html.push('</tr></thead><tbody>')
        inTable = true
        tableHeaderDone = true
        i++ // skip separator row
        continue
      } else if (isSeparatorRow(line)) {
        continue // skip stray separator
      } else if (inTable) {
        html.push('<tr>')
        for (const cell of parseTableRow(line))
          html.push(`<td>${inlineFormat(cell)}</td>`)
        html.push('</tr>')
        continue
      }
    } else {
      closeTable()
    }

    if (line.startsWith('### ')) {
      closeList(); html.push(`<h3>${inlineFormat(line.slice(4))}</h3>`)
    } else if (line.startsWith('## ')) {
      closeList(); html.push(`<h2>${inlineFormat(line.slice(3))}</h2>`)
    } else if (line.startsWith('# ')) {
      closeList(); html.push(`<h1>${inlineFormat(line.slice(2))}</h1>`)
    } else if (line.match(/^[-*] /)) {
      if (!inList) { html.push('<ul>'); inList = true }
      html.push(`<li>${inlineFormat(line.slice(2))}</li>`)
    } else if (line.match(/^\d+\. /)) {
      closeList(); html.push(`<p>${inlineFormat(line)}</p>`)
    } else if (line === '---') {
      closeList(); html.push('<hr>')
    } else if (line === '') {
      closeList()
    } else {
      closeList(); html.push(`<p>${inlineFormat(line)}</p>`)
    }
  }

  closeList()
  closeTable()
  return html.join('\n')
}

export function downloadAsPDF(title: string, markdown: string) {
  const body = markdownToHtml(markdown)
  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) {
    alert('Allow pop-ups to download PDF')
    return
  }

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', serif;
      font-size: 12pt;
      line-height: 1.65;
      color: #111;
      max-width: 780px;
      margin: 40px auto;
      padding: 0 24px;
    }
    h1 { font-size: 22pt; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #ccc; }
    h2 { font-size: 15pt; margin: 28px 0 8px; color: #222; }
    h3 { font-size: 12pt; font-weight: 700; margin: 18px 0 5px; color: #333; }
    p  { margin-bottom: 10px; }
    ul { padding-left: 22px; margin-bottom: 10px; }
    li { margin-bottom: 3px; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    code { background: #f4f4f4; padding: 1px 4px; font-family: monospace; font-size: 10pt; border-radius: 2px; }
    hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0 20px;
      font-size: 11pt;
    }
    th {
      background: #f0f0f0;
      font-weight: 700;
      text-align: left;
      padding: 7px 10px;
      border: 1px solid #bbb;
    }
    td {
      padding: 6px 10px;
      border: 1px solid #ccc;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #fafafa; }
    @media print {
      body { margin: 20px; }
      h2, h3 { page-break-after: avoid; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>${body}</body>
</html>`)

  printWindow.document.close()
  printWindow.focus()
  printWindow.setTimeout(() => {
    printWindow.print()
  }, 400)
}

// ─── DOCX via docx library ────────────────────────────────────────────────────

function parseInlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = []
  // Split on **bold** and *italic* patterns
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }))
    } else if (part.startsWith('*') && part.endsWith('*')) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true }))
    } else if (part.startsWith('`') && part.endsWith('`')) {
      runs.push(new TextRun({ text: part.slice(1, -1), font: 'Courier New', size: 20 }))
    } else if (part) {
      runs.push(new TextRun({ text: part }))
    }
  }
  return runs.length ? runs : [new TextRun({ text: '' })]
}

function markdownToDocxParagraphs(markdown: string): Paragraph[] {
  const lines = markdown.split('\n')
  const paragraphs: Paragraph[] = []
  let listBuffer: string[] = []

  const flushList = () => {
    for (const item of listBuffer) {
      paragraphs.push(new Paragraph({
        children: parseInlineRuns(item),
        bullet: { level: 0 },
      }))
    }
    listBuffer = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (line.startsWith('### ')) {
      flushList()
      paragraphs.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }))
    } else if (line.startsWith('## ')) {
      flushList()
      paragraphs.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }))
    } else if (line.startsWith('# ')) {
      flushList()
      paragraphs.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }))
    } else if (line.match(/^[-*] /)) {
      listBuffer.push(line.slice(2))
    } else if (line === '---') {
      flushList()
      paragraphs.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC', space: 1 } },
        children: [],
      }))
    } else if (line === '') {
      flushList()
      paragraphs.push(new Paragraph({ children: [] }))
    } else {
      flushList()
      paragraphs.push(new Paragraph({ children: parseInlineRuns(line) }))
    }
  }

  flushList()
  return paragraphs
}

export async function downloadAsDocx(title: string, markdown: string) {
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 24 } },
      },
    },
    sections: [{
      properties: {},
      children: markdownToDocxParagraphs(markdown),
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
