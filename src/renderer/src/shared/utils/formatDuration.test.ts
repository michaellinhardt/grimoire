import { describe, it, expect } from 'vitest'
import { formatDuration } from './formatDuration'

describe('formatDuration', () => {
  it('returns "< 1m" for 0 ms', () => {
    expect(formatDuration(0)).toBe('< 1m')
  })

  it('returns "< 1m" for values under 60 seconds', () => {
    expect(formatDuration(45000)).toBe('< 1m')
    expect(formatDuration(59999)).toBe('< 1m')
  })

  it('returns minutes only for values under 60 minutes', () => {
    expect(formatDuration(60000)).toBe('1m')
    expect(formatDuration(2700000)).toBe('45m')
    expect(formatDuration(3540000)).toBe('59m')
  })

  it('returns hours and minutes for values >= 60 minutes', () => {
    expect(formatDuration(3600000)).toBe('1h 0m')
    expect(formatDuration(7980000)).toBe('2h 13m')
    expect(formatDuration(86400000)).toBe('24h 0m')
  })

  it('handles negative values gracefully', () => {
    expect(formatDuration(-1000)).toBe('< 1m')
    expect(formatDuration(-86400000)).toBe('< 1m')
  })

  it('handles NaN gracefully', () => {
    expect(formatDuration(NaN)).toBe('< 1m')
  })

  it('handles null/undefined gracefully', () => {
    // @ts-expect-error - testing runtime behavior
    expect(formatDuration(null)).toBe('< 1m')
    // @ts-expect-error - testing runtime behavior
    expect(formatDuration(undefined)).toBe('< 1m')
  })

  it('handles very large values', () => {
    // 100 hours
    expect(formatDuration(360000000)).toBe('100h 0m')
  })
})
