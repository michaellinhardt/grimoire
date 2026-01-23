import { describe, it, expect } from 'vitest'
import { formatCost } from './formatCost'

describe('formatCost', () => {
  it('formats zero cost', () => {
    expect(formatCost(0)).toBe('$0.00')
  })

  it('formats small costs with 2 decimal places', () => {
    expect(formatCost(0.01)).toBe('$0.01')
    expect(formatCost(0.05)).toBe('$0.05')
    expect(formatCost(0.42)).toBe('$0.42')
  })

  it('formats costs over a dollar', () => {
    expect(formatCost(1)).toBe('$1.00')
    expect(formatCost(1.5)).toBe('$1.50')
    expect(formatCost(10.99)).toBe('$10.99')
    expect(formatCost(100.0)).toBe('$100.00')
  })

  it('rounds to 2 decimal places', () => {
    expect(formatCost(0.001)).toBe('$0.00')
    expect(formatCost(0.005)).toBe('$0.01') // rounds up
    expect(formatCost(0.994)).toBe('$0.99')
    // Note: 0.995 in floating point is actually 0.9949999... so rounds to 0.99
    // Using 0.996 which reliably rounds to 1.00
    expect(formatCost(0.996)).toBe('$1.00') // rounds up
  })

  it('handles large costs', () => {
    expect(formatCost(1000)).toBe('$1000.00')
    expect(formatCost(12345.67)).toBe('$12345.67')
  })

  it('handles invalid inputs defensively', () => {
    expect(formatCost(NaN)).toBe('$0.00')
    // @ts-expect-error - testing runtime behavior with undefined
    expect(formatCost(undefined)).toBe('$0.00')
    // @ts-expect-error - testing runtime behavior with null
    expect(formatCost(null)).toBe('$0.00')
  })
})
