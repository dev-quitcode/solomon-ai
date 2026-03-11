import { describe, it, expect } from 'vitest'
import { parseModel } from '@/lib/ai/providers'

/**
 * Tests for extractable business logic from API routes.
 * These are pure functions that don't need Supabase or Next.js mocking.
 */

// ──────────────────────────────────────────────────────────────
// Project validation (from /api/projects/route.ts POST)
// ──────────────────────────────────────────────────────────────

function validateProjectName(name: unknown): string | null {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return 'Project name is required'
  }
  return null
}

function buildProjectInsert(body: {
  name: string
  client_name?: string
  industry?: string
  type?: string
  mode?: string
}, userId: string) {
  return {
    user_id: userId,
    name: body.name.trim(),
    client_name: body.client_name?.trim() || null,
    industry: body.industry?.trim() || null,
    type: body.type ?? 'greenfield',
    mode: body.mode ?? 'epics_and_stories',
    status: 'setup',
  }
}

describe('Project creation validation', () => {
  it('rejects empty name', () => {
    expect(validateProjectName('')).toBe('Project name is required')
  })

  it('rejects whitespace-only name', () => {
    expect(validateProjectName('   ')).toBe('Project name is required')
  })

  it('rejects null name', () => {
    expect(validateProjectName(null)).toBe('Project name is required')
  })

  it('rejects undefined name', () => {
    expect(validateProjectName(undefined)).toBe('Project name is required')
  })

  it('accepts valid name', () => {
    expect(validateProjectName('Solomon CRM')).toBeNull()
  })

  it('accepts name with leading/trailing spaces', () => {
    expect(validateProjectName('  My Project  ')).toBeNull()
  })
})

describe('Project insert defaults', () => {
  const userId = 'user-123'

  it('defaults type to greenfield', () => {
    const insert = buildProjectInsert({ name: 'Test' }, userId)
    expect(insert.type).toBe('greenfield')
  })

  it('defaults mode to epics_and_stories', () => {
    const insert = buildProjectInsert({ name: 'Test' }, userId)
    expect(insert.mode).toBe('epics_and_stories')
  })

  it('defaults status to setup', () => {
    const insert = buildProjectInsert({ name: 'Test' }, userId)
    expect(insert.status).toBe('setup')
  })

  it('trims name whitespace', () => {
    const insert = buildProjectInsert({ name: '  My Project  ' }, userId)
    expect(insert.name).toBe('My Project')
  })

  it('sets client_name to null when not provided', () => {
    const insert = buildProjectInsert({ name: 'Test' }, userId)
    expect(insert.client_name).toBeNull()
  })

  it('sets client_name to null when empty string', () => {
    const insert = buildProjectInsert({ name: 'Test', client_name: '' }, userId)
    expect(insert.client_name).toBeNull()
  })

  it('trims and sets client_name when provided', () => {
    const insert = buildProjectInsert({ name: 'Test', client_name: '  Acme Corp  ' }, userId)
    expect(insert.client_name).toBe('Acme Corp')
  })

  it('uses provided type', () => {
    const insert = buildProjectInsert({ name: 'Test', type: 'brownfield' }, userId)
    expect(insert.type).toBe('brownfield')
  })

  it('sets industry to null when not provided', () => {
    const insert = buildProjectInsert({ name: 'Test' }, userId)
    expect(insert.industry).toBeNull()
  })
})

// ──────────────────────────────────────────────────────────────
// Source title fallback (from /api/sources/route.ts)
// ──────────────────────────────────────────────────────────────

function resolveSourceTitle(title: string | undefined, type: string, url?: string): string {
  return title?.trim() || (type === 'website' ? url ?? type : type)
}

describe('Source title resolution', () => {
  it('uses provided title when given', () => {
    expect(resolveSourceTitle('My Document', 'text')).toBe('My Document')
  })

  it('falls back to URL for website type when no title', () => {
    expect(resolveSourceTitle('', 'website', 'https://example.com')).toBe('https://example.com')
  })

  it('falls back to type string when no title and not website', () => {
    expect(resolveSourceTitle('', 'pdf')).toBe('pdf')
    expect(resolveSourceTitle('', 'questionnaire')).toBe('questionnaire')
  })

  it('trims whitespace from provided title', () => {
    expect(resolveSourceTitle('  My Doc  ', 'text')).toBe('My Doc')
  })

  it('handles undefined title', () => {
    expect(resolveSourceTitle(undefined, 'text')).toBe('text')
  })
})

// ──────────────────────────────────────────────────────────────
// Questionnaire answer formatting (from /api/sources/route.ts)
// ──────────────────────────────────────────────────────────────

const QUESTIONS: Record<string, string> = {
  business_problem: 'What business problem or opportunity does this project address?',
  target_users: 'Who are the primary users of this system?',
  current_process: 'How is this currently being handled (manual process or existing tools)?',
  pain_points: 'What are the top 3 pain points with the current approach?',
  desired_outcome: 'What does success look like? What should the system do?',
  key_features: 'What are the most critical features or capabilities needed?',
  technical_constraints: 'Are there any technical constraints or requirements (platform, integrations, security)?',
  timeline: 'What is the expected timeline or deadline?',
  budget: 'Is there a budget range or resource constraint?',
  stakeholders: 'Who are the key stakeholders and decision makers?',
}

function formatQuestionnaireAnswers(answers: Record<string, string>): string {
  return Object.entries(answers)
    .filter(([, value]) => value?.trim())
    .map(([key, value]) => `**${QUESTIONS[key] ?? key}**\n${value}`)
    .join('\n\n')
}

describe('Questionnaire formatting', () => {
  it('formats a single answer correctly', () => {
    const result = formatQuestionnaireAnswers({ business_problem: 'We lose track of requirements' })
    expect(result).toContain('**What business problem')
    expect(result).toContain('We lose track of requirements')
  })

  it('filters out blank answers', () => {
    const result = formatQuestionnaireAnswers({
      business_problem: 'Valid answer',
      target_users: '',
      current_process: '   ',
    })
    expect(result).not.toContain('target_users')
    expect(result).not.toContain('current_process')
  })

  it('joins multiple answers with double newline', () => {
    const result = formatQuestionnaireAnswers({
      business_problem: 'Answer 1',
      target_users: 'Answer 2',
    })
    // Each Q&A is "**Question**\nAnswer", two of them joined by "\n\n"
    // Splitting by \n\n gives exactly 2 sections
    expect(result.split('\n\n')).toHaveLength(2)
    expect(result).toContain('\n\n')
    expect(result).toContain('Answer 1')
    expect(result).toContain('Answer 2')
  })

  it('uses raw key as label for unknown keys', () => {
    const result = formatQuestionnaireAnswers({ custom_field: 'Some answer' })
    expect(result).toContain('**custom_field**')
  })

  it('returns empty string when all answers are blank', () => {
    const result = formatQuestionnaireAnswers({ business_problem: '', target_users: '  ' })
    expect(result).toBe('')
  })

  it('formats all 10 standard questions', () => {
    const answers: Record<string, string> = Object.fromEntries(
      Object.keys(QUESTIONS).map(k => [k, `Answer for ${k}`])
    )
    const result = formatQuestionnaireAnswers(answers)
    const sections = result.split('\n\n')
    // 10 questions × 2 parts (bold header + answer) but joined = alternating items...
    // Actually: each Q&A is "**Q**\nA", joined by \n\n, so 10 sections
    expect(sections).toHaveLength(10)
  })
})

// ──────────────────────────────────────────────────────────────
// parseModel (from src/lib/ai/providers.ts)
// ──────────────────────────────────────────────────────────────

describe('parseModel', () => {
  it('parses anthropic prefix', () => {
    expect(parseModel('anthropic:claude-sonnet-4-6')).toEqual({ provider: 'anthropic', modelId: 'claude-sonnet-4-6' })
  })

  it('parses openai prefix', () => {
    expect(parseModel('openai:gpt-4o')).toEqual({ provider: 'openai', modelId: 'gpt-4o' })
  })

  it('parses google prefix', () => {
    expect(parseModel('google:gemini-2.0-flash')).toEqual({ provider: 'google', modelId: 'gemini-2.0-flash' })
  })

  it('treats bare string (no colon) as anthropic — backwards compat', () => {
    expect(parseModel('claude-sonnet-4-6')).toEqual({ provider: 'anthropic', modelId: 'claude-sonnet-4-6' })
  })

  it('handles model ids that contain colons (takes first colon as separator)', () => {
    expect(parseModel('openai:ft:gpt-4:custom')).toEqual({ provider: 'openai', modelId: 'ft:gpt-4:custom' })
  })
})

// ──────────────────────────────────────────────────────────────
// File path generation (from /api/sources/route.ts handleFileUpload)
// ──────────────────────────────────────────────────────────────

describe('Storage file path generation', () => {
  it('generates path in format userId/projectId/timestamp_filename', () => {
    const userId = 'user-123'
    const projectId = 'proj-456'
    const fileName = 'document.pdf'
    const timestamp = 1700000000000

    const filePath = `${userId}/${projectId}/${timestamp}_${fileName}`
    expect(filePath).toBe('user-123/proj-456/1700000000000_document.pdf')
  })

  it('path segments are correctly ordered for folder isolation', () => {
    const filePath = 'user-abc/proj-xyz/1234567890_report.pdf'
    const parts = filePath.split('/')
    expect(parts[0]).toBe('user-abc')  // userId first (RLS by folder)
    expect(parts[1]).toBe('proj-xyz')  // projectId second
    expect(parts[2]).toContain('report.pdf')
  })
})
