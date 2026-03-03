import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn (class name utility)', () => {
  it('returns a single class name unchanged', () => {
    expect(cn('flex')).toBe('flex')
  })

  it('merges multiple class names', () => {
    expect(cn('flex', 'items-center')).toBe('flex items-center')
  })

  it('handles conditional classes — truthy includes, falsy excludes', () => {
    expect(cn('base', true && 'active', false && 'disabled')).toBe('base active')
  })

  it('resolves Tailwind conflicts — last wins', () => {
    // tailwind-merge: p-2 should be overridden by p-4
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('resolves text color conflicts', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles undefined and null gracefully', () => {
    expect(cn('flex', undefined, null, 'gap-2')).toBe('flex gap-2')
  })

  it('handles object syntax', () => {
    // tailwind-merge resolves display conflicts: 'flex' and 'block' both set display,
    // so the last one wins — correct behaviour, not a bug
    expect(cn({ flex: true, hidden: false, block: true })).toBe('block')
    // Non-conflicting object classes are all included
    expect(cn({ 'font-bold': true, 'text-sm': true, italic: false })).toBe('font-bold text-sm')
  })

  it('handles array syntax', () => {
    expect(cn(['flex', 'items-center'])).toBe('flex items-center')
  })

  it('returns empty string when no valid classes', () => {
    expect(cn(undefined, false && 'x')).toBe('')
  })

  it('merges non-conflicting Tailwind classes', () => {
    const result = cn('px-4 py-2', 'text-sm font-medium')
    expect(result).toBe('px-4 py-2 text-sm font-medium')
  })
})
