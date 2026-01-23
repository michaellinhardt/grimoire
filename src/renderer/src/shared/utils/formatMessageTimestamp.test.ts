import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatMessageTimestamp } from './formatMessageTimestamp'

describe('formatMessageTimestamp', () => {
  beforeEach(() => {
    // Mock Date.now to a fixed time: Jan 23, 2026 12:00:00 UTC
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-23T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty string for null', () => {
    expect(formatMessageTimestamp(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatMessageTimestamp(undefined)).toBe('')
  })

  it('uses relative time for timestamps less than 24 hours ago', () => {
    const twoHoursAgo = Date.now() - 1000 * 60 * 60 * 2
    expect(formatMessageTimestamp(twoHoursAgo)).toBe('2h ago')
  })

  it('uses relative time for timestamps less than 1 hour ago', () => {
    const thirtyMinutesAgo = Date.now() - 1000 * 60 * 30
    expect(formatMessageTimestamp(thirtyMinutesAgo)).toBe('30m ago')
  })

  it('shows Just now for very recent timestamps', () => {
    const justNow = Date.now() - 1000 * 30 // 30 seconds ago
    expect(formatMessageTimestamp(justNow)).toBe('Just now')
  })

  it('shows absolute date for timestamps 24+ hours ago', () => {
    const twoDaysAgo = Date.now() - 1000 * 60 * 60 * 48
    const result = formatMessageTimestamp(twoDaysAgo)
    // Format should include month, day, and time in HH:MM format
    expect(result).toMatch(/Jan 21, \d{2}:\d{2}/)
  })

  it('includes year for timestamps from different year', () => {
    const lastYear = new Date('2025-12-15T10:30:00Z').getTime()
    const result = formatMessageTimestamp(lastYear)
    expect(result).toContain('2025')
    // Format: "Dec 15, 2025, HH:MM"
    expect(result).toMatch(/Dec 15, 2025, \d{2}:\d{2}/)
  })

  it('handles edge case at exactly 24 hours', () => {
    const exactly24HoursAgo = Date.now() - 1000 * 60 * 60 * 24
    const result = formatMessageTimestamp(exactly24HoursAgo)
    // At exactly 24h, should show absolute date (not relative time)
    // System time is Jan 23, 2026 12:00:00 UTC, so 24h ago is Jan 22, 2026 12:00:00 UTC
    expect(result).not.toMatch(/ago$/)
    expect(result).toMatch(/Jan 22, \d{2}:\d{2}/) // Verify correct date (Jan 22) and time format
  })

  it('handles timestamp from same day older than 24h due to timezone', () => {
    // 23 hours ago should still be relative
    const twentyThreeHoursAgo = Date.now() - 1000 * 60 * 60 * 23
    const result = formatMessageTimestamp(twentyThreeHoursAgo)
    expect(result).toBe('23h ago')
  })

  it('handles zero timestamp', () => {
    const result = formatMessageTimestamp(0)
    // 0 is Jan 1, 1970 - should include year
    expect(result).toContain('1970')
  })
})
