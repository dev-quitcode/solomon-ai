import { describe, it, expect } from 'vitest'

/**
 * Tests for the document code generation formulas used in:
 *   - /api/epics/route.ts (POST)
 *   - /api/ai/epics/route.ts
 *   - /api/stories/route.ts (POST)
 *   - /api/ai/stories/route.ts
 */

function generateEpicCode(existingCount: number): string {
  return `E-${String(existingCount + 1).padStart(3, '0')}`
}

function generateStoryCode(existingCount: number): string {
  return `US-${String(existingCount + 1).padStart(3, '0')}`
}

function generateBulkCodes(prefix: string, existingCount: number, newCount: number): string[] {
  return Array.from({ length: newCount }, (_, i) =>
    `${prefix}-${String(existingCount + i + 1).padStart(3, '0')}`
  )
}

describe('Epic code generation', () => {
  it('generates E-001 when no epics exist', () => {
    expect(generateEpicCode(0)).toBe('E-001')
  })

  it('generates E-002 when one epic exists', () => {
    expect(generateEpicCode(1)).toBe('E-002')
  })

  it('pads single-digit numbers to 3 digits', () => {
    expect(generateEpicCode(8)).toBe('E-009')
  })

  it('handles double-digit codes', () => {
    expect(generateEpicCode(10)).toBe('E-011')
  })

  it('handles triple-digit codes', () => {
    expect(generateEpicCode(99)).toBe('E-100')
  })

  it('uses null-safe count with ?? 0 fallback', () => {
    const count = null
    expect(generateEpicCode(count ?? 0)).toBe('E-001')
  })
})

describe('User Story code generation', () => {
  it('generates US-001 when no stories exist', () => {
    expect(generateStoryCode(0)).toBe('US-001')
  })

  it('generates US-002 when one story exists', () => {
    expect(generateStoryCode(1)).toBe('US-002')
  })

  it('pads correctly for single digits', () => {
    expect(generateStoryCode(5)).toBe('US-006')
  })

  it('handles double-digit story counts', () => {
    expect(generateStoryCode(15)).toBe('US-016')
  })

  it('uses null-safe count with ?? 0 fallback', () => {
    const count = null
    expect(generateStoryCode(count ?? 0)).toBe('US-001')
  })
})

describe('Bulk code generation (AI generation batch insert)', () => {
  it('generates sequential epic codes for a batch', () => {
    const codes = generateBulkCodes('E', 0, 5)
    expect(codes).toEqual(['E-001', 'E-002', 'E-003', 'E-004', 'E-005'])
  })

  it('continues from existing count', () => {
    const codes = generateBulkCodes('E', 3, 3)
    expect(codes).toEqual(['E-004', 'E-005', 'E-006'])
  })

  it('generates sequential story codes for a batch', () => {
    const codes = generateBulkCodes('US', 0, 4)
    expect(codes).toEqual(['US-001', 'US-002', 'US-003', 'US-004'])
  })

  it('generates single code when batch size is 1', () => {
    const codes = generateBulkCodes('E', 0, 1)
    expect(codes).toEqual(['E-001'])
  })

  it('returns empty array when batch size is 0', () => {
    const codes = generateBulkCodes('E', 5, 0)
    expect(codes).toEqual([])
  })
})
