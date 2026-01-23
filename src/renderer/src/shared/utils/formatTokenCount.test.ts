import { describe, it, expect } from 'vitest'
import { formatTokenCount } from './formatTokenCount'

describe('formatTokenCount', () => {
  it('returns raw number for counts under 1000', () => {
    expect(formatTokenCount(0)).toBe('0')
    expect(formatTokenCount(1)).toBe('1')
    expect(formatTokenCount(123)).toBe('123')
    expect(formatTokenCount(999)).toBe('999')
  })

  it('formats thousands with k suffix', () => {
    expect(formatTokenCount(1000)).toBe('1.0k')
    expect(formatTokenCount(1500)).toBe('1.5k')
    expect(formatTokenCount(12500)).toBe('12.5k')
    expect(formatTokenCount(999499)).toBe('999.5k') // Just under threshold
  })

  it('switches to M before displaying 1000.0k', () => {
    // At 999500, toFixed(1) on 999.5 would round to 999.5k
    // At 999500+, we switch to M to avoid awkward "1000.0k"
    expect(formatTokenCount(999500)).toBe('1.0M')
    expect(formatTokenCount(999999)).toBe('1.0M')
  })

  it('formats millions with M suffix', () => {
    expect(formatTokenCount(1000000)).toBe('1.0M')
    expect(formatTokenCount(1500000)).toBe('1.5M')
    expect(formatTokenCount(12500000)).toBe('12.5M')
  })

  it('handles edge cases', () => {
    expect(formatTokenCount(1001)).toBe('1.0k')
    expect(formatTokenCount(1050)).toBe('1.1k') // 1.05 rounds to 1.1 with toFixed(1)
    expect(formatTokenCount(1049)).toBe('1.0k') // 1.049 rounds to 1.0
  })

  it('handles invalid inputs defensively', () => {
    expect(formatTokenCount(NaN)).toBe('0')
    expect(formatTokenCount(-100)).toBe('0')
    expect(formatTokenCount(-1)).toBe('0')
    // @ts-expect-error - testing runtime behavior with undefined
    expect(formatTokenCount(undefined)).toBe('0')
    // @ts-expect-error - testing runtime behavior with null
    expect(formatTokenCount(null)).toBe('0')
  })
})
