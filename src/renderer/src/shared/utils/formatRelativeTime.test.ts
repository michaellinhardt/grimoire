import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatRelativeTime } from './formatRelativeTime'

describe('formatRelativeTime', () => {
  beforeEach(() => {
    // Mock Date.now() to return a fixed timestamp for consistent tests
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-22T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Never" for null', () => {
    expect(formatRelativeTime(null)).toBe('Never')
  })

  it('returns "Never" for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('Never')
  })

  it('returns "Just now" for timestamps less than 60 seconds ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 30 * 1000)).toBe('Just now')
    expect(formatRelativeTime(now - 59 * 1000)).toBe('Just now')
    expect(formatRelativeTime(now)).toBe('Just now')
  })

  it('returns "Xm ago" for timestamps in the minutes range', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 60 * 1000)).toBe('1m ago')
    expect(formatRelativeTime(now - 5 * 60 * 1000)).toBe('5m ago')
    expect(formatRelativeTime(now - 59 * 60 * 1000)).toBe('59m ago')
  })

  it('returns "Xh ago" for timestamps in the hours range', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 60 * 60 * 1000)).toBe('1h ago')
    expect(formatRelativeTime(now - 5 * 60 * 60 * 1000)).toBe('5h ago')
    expect(formatRelativeTime(now - 23 * 60 * 60 * 1000)).toBe('23h ago')
  })

  it('returns "Yesterday" for timestamps from 1 day ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 24 * 60 * 60 * 1000)).toBe('Yesterday')
    expect(formatRelativeTime(now - 36 * 60 * 60 * 1000)).toBe('Yesterday')
  })

  it('returns "Xd ago" for timestamps from 2-6 days ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60 * 1000)).toBe('2d ago')
    expect(formatRelativeTime(now - 6 * 24 * 60 * 60 * 1000)).toBe('6d ago')
  })

  it('returns formatted date for timestamps older than 7 days', () => {
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const result = formatRelativeTime(sevenDaysAgo)
    // Should be a locale date string, verify it's not one of the relative formats
    expect(result).not.toContain('ago')
    expect(result).not.toBe('Yesterday')
    expect(result).not.toBe('Just now')
    expect(result).not.toBe('Never')
  })
})
