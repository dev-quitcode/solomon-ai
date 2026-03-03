import { describe, it, expect } from 'vitest'

/**
 * Tests for the AI response JSON parsing used in:
 *   - /api/ai/epics/route.ts
 *   - /api/ai/stories/route.ts
 *
 * Claude sometimes wraps JSON in markdown fences. These tests verify
 * the regex extraction handles all realistic response formats.
 */

function extractJsonArray(text: string): string | null {
  const match = text.match(/\[[\s\S]*\]/)
  return match ? match[0] : null
}

function parseEpicsResponse(text: string) {
  const jsonMatch = extractJsonArray(text)
  if (!jsonMatch) return null
  return JSON.parse(jsonMatch) as Array<{
    title: string
    description: string
    acceptance_criteria: string
    priority: string
  }>
}

describe('AI JSON array extraction', () => {
  it('extracts plain JSON array from raw response', () => {
    const response = '[{"title":"Epic A","description":"Desc","acceptance_criteria":"AC","priority":"must"}]'
    const result = extractJsonArray(response)
    expect(result).not.toBeNull()
    expect(JSON.parse(result!)).toHaveLength(1)
  })

  it('extracts JSON array wrapped in markdown code fence', () => {
    const response = '```json\n[{"title":"Epic A","description":"Desc","acceptance_criteria":"AC","priority":"must"}]\n```'
    const result = extractJsonArray(response)
    expect(result).not.toBeNull()
    const parsed = JSON.parse(result!)
    expect(parsed[0].title).toBe('Epic A')
  })

  it('extracts JSON array with preamble text', () => {
    const response = 'Here are the epics I generated:\n\n[{"title":"Epic A","description":"D","acceptance_criteria":"A","priority":"should"}]'
    const result = extractJsonArray(response)
    expect(result).not.toBeNull()
  })

  it('extracts JSON array with postamble text', () => {
    const response = '[{"title":"Epic A","description":"D","acceptance_criteria":"A","priority":"should"}]\n\nNote: These epics cover the full scope.'
    const result = extractJsonArray(response)
    expect(result).not.toBeNull()
  })

  it('returns null when no JSON array is present', () => {
    expect(extractJsonArray('No JSON here, just text.')).toBeNull()
    expect(extractJsonArray('')).toBeNull()
    expect(extractJsonArray('{"key":"object not array"}')).toBeNull()
  })

  it('handles a multi-epic JSON array', () => {
    const response = JSON.stringify([
      { title: 'User Auth', description: 'Login/signup', acceptance_criteria: 'Users can log in', priority: 'must' },
      { title: 'Dashboard', description: 'Main view', acceptance_criteria: 'Shows summary', priority: 'should' },
      { title: 'Reports', description: 'Analytics', acceptance_criteria: 'Charts render', priority: 'could' },
    ])
    const epics = parseEpicsResponse(response)
    expect(epics).toHaveLength(3)
    expect(epics![0].priority).toBe('must')
    expect(epics![2].title).toBe('Reports')
  })

  it('handles multiline JSON with newlines in values', () => {
    const response = `[
  {
    "title": "User Management",
    "description": "Handles all user operations including\\ncreation and deletion.",
    "acceptance_criteria": "- Users can be created\\n- Users can be deleted",
    "priority": "must"
  }
]`
    const epics = parseEpicsResponse(response)
    expect(epics).toHaveLength(1)
    expect(epics![0].title).toBe('User Management')
  })

  it('does not match a JSON object (non-array)', () => {
    const response = '{"title": "not an array"}'
    expect(extractJsonArray(response)).toBeNull()
  })
})

describe('Prompt hierarchy resolution', () => {
  /**
   * The prompt resolution logic from all AI routes:
   * const systemInstruction = projectPrompt?.content ?? systemPrompt?.content ?? ''
   */

  function resolvePrompt(
    projectPrompt: { content: string } | null | undefined,
    systemPrompt: { content: string } | null | undefined,
  ): string {
    return projectPrompt?.content ?? systemPrompt?.content ?? ''
  }

  it('uses project prompt when available', () => {
    const result = resolvePrompt({ content: 'project-override' }, { content: 'system-default' })
    expect(result).toBe('project-override')
  })

  it('falls back to system prompt when no project override', () => {
    const result = resolvePrompt(null, { content: 'system-default' })
    expect(result).toBe('system-default')
  })

  it('falls back to system prompt when project prompt is undefined', () => {
    const result = resolvePrompt(undefined, { content: 'system-default' })
    expect(result).toBe('system-default')
  })

  it('returns empty string when both prompts are null', () => {
    const result = resolvePrompt(null, null)
    expect(result).toBe('')
  })

  it('uses project prompt even when content is empty string', () => {
    // An empty project override intentionally clears the prompt
    const result = resolvePrompt({ content: '' }, { content: 'system-default' })
    expect(result).toBe('')
  })
})

describe('Source context formatting', () => {
  /**
   * The source context builder used in ai/charter and ai/prd routes:
   * sources.map(s => `### [${s.type.toUpperCase()}] ${s.title}\n${s.content}`).join('\n\n---\n\n')
   */

  interface Source { type: string; title: string; content: string | null }

  function buildSourceContext(sources: Source[]): string {
    return sources
      .map(s => `### [${s.type.toUpperCase()}] ${s.title}\n${s.content}`)
      .join('\n\n---\n\n')
  }

  it('formats a single source correctly', () => {
    const result = buildSourceContext([{ type: 'text', title: 'My Document', content: 'Hello world' }])
    expect(result).toBe('### [TEXT] My Document\nHello world')
  })

  it('uppercases the source type', () => {
    const result = buildSourceContext([{ type: 'pdf', title: 'Report', content: 'Content' }])
    expect(result).toContain('[PDF]')
  })

  it('joins multiple sources with separator', () => {
    const result = buildSourceContext([
      { type: 'text', title: 'Doc 1', content: 'Content 1' },
      { type: 'pdf', title: 'Doc 2', content: 'Content 2' },
    ])
    expect(result).toContain('\n\n---\n\n')
    expect(result.split('\n\n---\n\n')).toHaveLength(2)
  })

  it('returns empty string for no sources', () => {
    expect(buildSourceContext([])).toBe('')
  })

  it('formats call_transcript type correctly', () => {
    const result = buildSourceContext([{ type: 'call_transcript', title: 'Client Call', content: 'Transcript text' }])
    expect(result).toContain('[CALL_TRANSCRIPT]')
  })
})
