import { describe, it, expect } from 'vitest'
import { getSessionDisplayName } from './getSessionDisplayName'

describe('getSessionDisplayName', () => {
  it('extracts last segment from path', () => {
    expect(getSessionDisplayName('/Users/test/myproject')).toBe('myproject')
    expect(getSessionDisplayName('/home/user/projects/awesome-app')).toBe('awesome-app')
  })

  it('handles trailing slash', () => {
    expect(getSessionDisplayName('/Users/test/myproject/')).toBe('myproject')
  })

  it('handles paths with multiple slashes', () => {
    expect(getSessionDisplayName('/a/b/c/d/e')).toBe('e')
  })

  it('returns "Unknown Project" for root path', () => {
    expect(getSessionDisplayName('/')).toBe('Unknown Project')
  })

  it('returns "Unknown Project" for empty string', () => {
    expect(getSessionDisplayName('')).toBe('Unknown Project')
  })

  it('handles single segment paths', () => {
    expect(getSessionDisplayName('/myproject')).toBe('myproject')
  })

  it('handles paths without leading slash', () => {
    expect(getSessionDisplayName('myproject')).toBe('myproject')
    expect(getSessionDisplayName('folder/myproject')).toBe('myproject')
  })

  // Windows path support for cross-platform compatibility
  it('handles Windows paths with backslashes', () => {
    expect(getSessionDisplayName('C:\\Users\\test\\myproject')).toBe('myproject')
    expect(getSessionDisplayName('D:\\Projects\\awesome-app')).toBe('awesome-app')
  })

  it('handles Windows paths with trailing backslash', () => {
    expect(getSessionDisplayName('C:\\Users\\test\\myproject\\')).toBe('myproject')
  })

  it('handles mixed path separators', () => {
    // Some tools may produce mixed separators
    expect(getSessionDisplayName('C:/Users\\test/myproject')).toBe('myproject')
  })
})
