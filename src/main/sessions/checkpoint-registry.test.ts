import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkpointRegistry,
  addCheckpoint,
  getCheckpoints,
  clearCheckpoints
} from './checkpoint-registry'

describe('checkpoint-registry', () => {
  beforeEach(() => {
    // Clear registry before each test
    checkpointRegistry.clear()
  })

  describe('addCheckpoint', () => {
    it('adds checkpoint to session', () => {
      addCheckpoint('session-1', 'checkpoint-a')
      expect(getCheckpoints('session-1')).toEqual(['checkpoint-a'])
    })

    it('maintains chronological order', () => {
      addCheckpoint('session-1', 'checkpoint-a')
      addCheckpoint('session-1', 'checkpoint-b')
      addCheckpoint('session-1', 'checkpoint-c')

      expect(getCheckpoints('session-1')).toEqual(['checkpoint-a', 'checkpoint-b', 'checkpoint-c'])
    })

    it('prevents duplicate checkpoints', () => {
      addCheckpoint('session-1', 'checkpoint-a')
      addCheckpoint('session-1', 'checkpoint-a')

      expect(getCheckpoints('session-1')).toEqual(['checkpoint-a'])
    })

    it('limits checkpoints to MAX_CHECKPOINTS_PER_SESSION', () => {
      // Add 105 checkpoints
      for (let i = 0; i < 105; i++) {
        addCheckpoint('session-1', `checkpoint-${i}`)
      }

      const checkpoints = getCheckpoints('session-1')
      expect(checkpoints.length).toBe(100)
      // Should have removed oldest (0-4), keeping 5-104
      expect(checkpoints[0]).toBe('checkpoint-5')
      expect(checkpoints[99]).toBe('checkpoint-104')
    })

    it('handles multiple sessions independently', () => {
      addCheckpoint('session-1', 'checkpoint-a')
      addCheckpoint('session-2', 'checkpoint-b')
      addCheckpoint('session-1', 'checkpoint-c')

      expect(getCheckpoints('session-1')).toEqual(['checkpoint-a', 'checkpoint-c'])
      expect(getCheckpoints('session-2')).toEqual(['checkpoint-b'])
    })
  })

  describe('getCheckpoints', () => {
    it('returns empty array for unknown session', () => {
      expect(getCheckpoints('unknown-session')).toEqual([])
    })

    it('returns checkpoints for known session', () => {
      addCheckpoint('session-1', 'checkpoint-a')
      expect(getCheckpoints('session-1')).toEqual(['checkpoint-a'])
    })
  })

  describe('clearCheckpoints', () => {
    it('removes all checkpoints for session', () => {
      addCheckpoint('session-1', 'checkpoint-a')
      addCheckpoint('session-1', 'checkpoint-b')

      clearCheckpoints('session-1')

      expect(getCheckpoints('session-1')).toEqual([])
    })

    it('does not affect other sessions', () => {
      addCheckpoint('session-1', 'checkpoint-a')
      addCheckpoint('session-2', 'checkpoint-b')

      clearCheckpoints('session-1')

      expect(getCheckpoints('session-1')).toEqual([])
      expect(getCheckpoints('session-2')).toEqual(['checkpoint-b'])
    })

    it('handles clearing non-existent session', () => {
      // Should not throw
      clearCheckpoints('non-existent')
      expect(getCheckpoints('non-existent')).toEqual([])
    })
  })
})
