import { describe, it, expect } from 'vitest'
import { toSessionMetadata, type DBSessionMetadataRow } from './session-metadata'

describe('toSessionMetadata', () => {
  it('transforms DB row to SessionMetadata with all fields', () => {
    const row: DBSessionMetadataRow = {
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      total_input_tokens: 1000,
      total_output_tokens: 500,
      total_cost_usd: 0.05,
      model: 'claude-sonnet-4-20250514',
      updated_at: 1700000000000
    }

    const result = toSessionMetadata(row)

    expect(result).toEqual({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      totalCostUsd: 0.05,
      model: 'claude-sonnet-4-20250514',
      updatedAt: 1700000000000
    })
  })

  it('handles null model and updatedAt', () => {
    const row: DBSessionMetadataRow = {
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost_usd: 0,
      model: null,
      updated_at: null
    }

    const result = toSessionMetadata(row)

    expect(result.model).toBeNull()
    expect(result.updatedAt).toBeNull()
  })

  it('preserves exact numeric values', () => {
    const row: DBSessionMetadataRow = {
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      total_input_tokens: 123456,
      total_output_tokens: 654321,
      total_cost_usd: 1.234567,
      model: null,
      updated_at: null
    }

    const result = toSessionMetadata(row)

    expect(result.totalInputTokens).toBe(123456)
    expect(result.totalOutputTokens).toBe(654321)
    expect(result.totalCostUsd).toBe(1.234567)
  })
})
