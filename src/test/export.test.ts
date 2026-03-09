import { describe, it, expect } from 'vitest'

/**
 * Tests for the markdown conversion utilities in src/lib/utils/export.ts.
 *
 * markdownToHtml and parseInlineRuns are private helpers, so they are
 * duplicated here inline (following the same pattern as ai-response.test.ts).
 * Any changes to the source functions must be reflected here.
 */

// ── markdownToHtml (from export.ts) ──────────────────────────────────────────

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split('\n')
  const html: string[] = []
  let inList = false

  const closeList = () => {
    if (inList) { html.push('</ul>'); inList = false }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (line.startsWith('### ')) {
      closeList(); html.push(`<h3>${inlineFormat(line.slice(4))}</h3>`)
    } else if (line.startsWith('## ')) {
      closeList(); html.push(`<h2>${inlineFormat(line.slice(3))}</h2>`)
    } else if (line.startsWith('# ')) {
      closeList(); html.push(`<h1>${inlineFormat(line.slice(2))}</h1>`)
    } else if (line.match(/^[-*] /)) {
      if (!inList) { html.push('<ul>'); inList = true }
      html.push(`<li>${inlineFormat(line.slice(2))}</li>`)
    } else if (line === '---') {
      closeList(); html.push('<hr>')
    } else if (line === '') {
      closeList()
    } else {
      closeList(); html.push(`<p>${inlineFormat(line)}</p>`)
    }
  }

  closeList()
  return html.join('\n')
}

// ── parseInlineRuns (structural shape test, no docx dependency) ───────────────

interface InlineRun {
  text: string
  bold?: boolean
  italics?: boolean
  isCode?: boolean
}

function parseInlineRuns(text: string): InlineRun[] {
  const runs: InlineRun[] = []
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push({ text: part.slice(2, -2), bold: true })
    } else if (part.startsWith('*') && part.endsWith('*')) {
      runs.push({ text: part.slice(1, -1), italics: true })
    } else if (part.startsWith('`') && part.endsWith('`')) {
      runs.push({ text: part.slice(1, -1), isCode: true })
    } else if (part) {
      runs.push({ text: part })
    }
  }
  return runs.length ? runs : [{ text: '' }]
}

// ─────────────────────────────────────────────────────────────────────────────

describe('markdownToHtml — headings', () => {
  it('converts # to <h1>', () => {
    expect(markdownToHtml('# Title')).toBe('<h1>Title</h1>')
  })

  it('converts ## to <h2>', () => {
    expect(markdownToHtml('## Section')).toBe('<h2>Section</h2>')
  })

  it('converts ### to <h3>', () => {
    expect(markdownToHtml('### Subsection')).toBe('<h3>Subsection</h3>')
  })

  it('applies inline formatting inside headings', () => {
    expect(markdownToHtml('## **Bold** Heading')).toBe('<h2><strong>Bold</strong> Heading</h2>')
  })

  it('renders #### as a plain paragraph (only h1–h3 supported)', () => {
    // The parser checks for '### ' with a trailing space, so '####' does not match
    const result = markdownToHtml('#### Deep')
    expect(result).toBe('<p>#### Deep</p>')
  })
})

describe('markdownToHtml — bullet lists', () => {
  it('wraps items in <ul> and <li>', () => {
    const result = markdownToHtml('- Item A\n- Item B')
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>Item A</li>')
    expect(result).toContain('<li>Item B</li>')
    expect(result).toContain('</ul>')
  })

  it('supports * as a bullet marker', () => {
    const result = markdownToHtml('* Item X')
    expect(result).toContain('<li>Item X</li>')
  })

  it('closes list before a heading', () => {
    const result = markdownToHtml('- Item\n## Heading')
    expect(result.indexOf('</ul>')).toBeLessThan(result.indexOf('<h2>'))
  })

  it('closes list before a paragraph', () => {
    const result = markdownToHtml('- Item\n\nParagraph text')
    expect(result).toContain('</ul>')
    expect(result).toContain('<p>Paragraph text</p>')
  })

  it('closes list at end of input', () => {
    const result = markdownToHtml('- Last item')
    expect(result).toContain('</ul>')
  })

  it('applies inline formatting inside list items', () => {
    const result = markdownToHtml('- **Bold** item')
    expect(result).toContain('<li><strong>Bold</strong> item</li>')
  })
})

describe('markdownToHtml — paragraphs and rules', () => {
  it('wraps plain text in <p>', () => {
    expect(markdownToHtml('Hello world')).toBe('<p>Hello world</p>')
  })

  it('converts --- to <hr>', () => {
    expect(markdownToHtml('---')).toBe('<hr>')
  })

  it('ignores empty lines (no output)', () => {
    const result = markdownToHtml('Line one\n\nLine two')
    expect(result).not.toContain('<p></p>')
    expect(result).toContain('<p>Line one</p>')
    expect(result).toContain('<p>Line two</p>')
  })

  it('produces multiple paragraphs joined by newlines', () => {
    const result = markdownToHtml('First\nSecond')
    expect(result).toBe('<p>First</p>\n<p>Second</p>')
  })

  it('handles empty input', () => {
    expect(markdownToHtml('')).toBe('')
  })
})

describe('markdownToHtml — inline formatting', () => {
  it('converts **text** to <strong>', () => {
    expect(markdownToHtml('This is **bold** text')).toBe('<p>This is <strong>bold</strong> text</p>')
  })

  it('converts *text* to <em>', () => {
    expect(markdownToHtml('This is *italic* text')).toBe('<p>This is <em>italic</em> text</p>')
  })

  it('converts `code` to <code>', () => {
    expect(markdownToHtml('Run `npm install` now')).toBe('<p>Run <code>npm install</code> now</p>')
  })

  it('handles multiple inline formats in one line', () => {
    const result = markdownToHtml('**Bold**, *italic*, and `code`')
    expect(result).toContain('<strong>Bold</strong>')
    expect(result).toContain('<em>italic</em>')
    expect(result).toContain('<code>code</code>')
  })
})

describe('markdownToHtml — mixed content', () => {
  it('renders a typical document section', () => {
    const md = [
      '# Project Charter',
      '',
      '## Objectives',
      '',
      '- Deliver MVP by Q3',
      '- Achieve **99%** uptime',
      '',
      '---',
      '',
      'Approved by *management*.',
    ].join('\n')

    const result = markdownToHtml(md)
    expect(result).toContain('<h1>Project Charter</h1>')
    expect(result).toContain('<h2>Objectives</h2>')
    expect(result).toContain('<li>Deliver MVP by Q3</li>')
    expect(result).toContain('<strong>99%</strong>')
    expect(result).toContain('<hr>')
    expect(result).toContain('<em>management</em>')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('parseInlineRuns — text segmentation', () => {
  it('returns a single plain run for plain text', () => {
    const runs = parseInlineRuns('Hello world')
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ text: 'Hello world' })
    expect(runs[0].bold).toBeUndefined()
  })

  it('returns empty-text run for empty string', () => {
    const runs = parseInlineRuns('')
    expect(runs).toHaveLength(1)
    expect(runs[0].text).toBe('')
  })

  it('marks **text** as bold', () => {
    const runs = parseInlineRuns('**Important**')
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ text: 'Important', bold: true })
  })

  it('marks *text* as italic', () => {
    const runs = parseInlineRuns('*Note*')
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ text: 'Note', italics: true })
  })

  it('marks `code` as code', () => {
    const runs = parseInlineRuns('`console.log`')
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ text: 'console.log', isCode: true })
  })

  it('splits mixed text into multiple runs', () => {
    const runs = parseInlineRuns('Hello **world** and *you*')
    expect(runs.length).toBeGreaterThanOrEqual(3)
    const boldRun = runs.find(r => r.bold)
    const italicRun = runs.find(r => r.italics)
    expect(boldRun?.text).toBe('world')
    expect(italicRun?.text).toBe('you')
  })

  it('produces a plain run for text surrounding a bold span', () => {
    const runs = parseInlineRuns('Before **bold** after')
    const plainRuns = runs.filter(r => !r.bold && !r.italics && !r.isCode)
    const texts = plainRuns.map(r => r.text)
    expect(texts.join('')).toContain('Before ')
    expect(texts.join('')).toContain(' after')
  })

  it('handles multiple bold spans', () => {
    const runs = parseInlineRuns('**A** and **B**')
    const boldRuns = runs.filter(r => r.bold)
    expect(boldRuns).toHaveLength(2)
    expect(boldRuns[0].text).toBe('A')
    expect(boldRuns[1].text).toBe('B')
  })

  it('handles bold adjacent to italic', () => {
    const runs = parseInlineRuns('**bold***italic*')
    const boldRun = runs.find(r => r.bold)
    const italicRun = runs.find(r => r.italics)
    expect(boldRun?.text).toBe('bold')
    expect(italicRun?.text).toBe('italic')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('document filename sanitisation', () => {
  /**
   * The download filename formula from downloadAsDocx:
   * `${title.replace(/[^a-z0-9]/gi, '_')}.docx`
   */
  function sanitiseFilename(title: string): string {
    return `${title.replace(/[^a-z0-9]/gi, '_')}.docx`
  }

  it('replaces spaces with underscores', () => {
    expect(sanitiseFilename('Project Charter')).toBe('Project_Charter.docx')
  })

  it('replaces special characters', () => {
    expect(sanitiseFilename('My Project: 2024')).toBe('My_Project__2024.docx')
  })

  it('preserves alphanumeric characters', () => {
    expect(sanitiseFilename('SolomonCRM2024')).toBe('SolomonCRM2024.docx')
  })

  it('handles empty title', () => {
    expect(sanitiseFilename('')).toBe('.docx')
  })

  it('replaces slashes and dots', () => {
    expect(sanitiseFilename('v1.0/release')).toBe('v1_0_release.docx')
  })
})
