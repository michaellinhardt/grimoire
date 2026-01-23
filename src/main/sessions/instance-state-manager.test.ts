import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mocks
const { mockEmitToRenderer, mockGetAllWindows } = vi.hoisted(() => ({
  mockEmitToRenderer: vi.fn(),
  mockGetAllWindows: vi.fn(() => [])
}))

// Mock dependencies
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: mockGetAllWindows
  }
}))

vi.mock('./stream-parser', () => ({
  emitToRenderer: mockEmitToRenderer
}))

// Import after mocks
import { instanceStateManager } from './instance-state-manager'

describe('InstanceStateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear internal state by removing all tracked sessions
    // Note: In production, sessions are never removed unless explicitly done
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getState', () => {
    it('returns idle for unknown session', () => {
      const state = instanceStateManager.getState('unknown-session')
      expect(state).toBe('idle')
    })

    it('returns current state for tracked session', () => {
      instanceStateManager.setState('test-session', 'working')
      const state = instanceStateManager.getState('test-session')
      expect(state).toBe('working')
    })
  })

  describe('transition', () => {
    describe('idle state transitions', () => {
      it('transitions from idle to working on SEND_MESSAGE', () => {
        const sessionId = 'idle-to-working-' + Date.now()
        instanceStateManager.setState(sessionId, 'idle')

        const newState = instanceStateManager.transition(sessionId, 'SEND_MESSAGE')

        expect(newState).toBe('working')
        expect(instanceStateManager.getState(sessionId)).toBe('working')
      })

      it('stays idle on PROCESS_EXIT', () => {
        const sessionId = 'idle-stay-' + Date.now()
        instanceStateManager.setState(sessionId, 'idle')

        const newState = instanceStateManager.transition(sessionId, 'PROCESS_EXIT')

        expect(newState).toBe('idle')
      })

      it('stays idle on ACKNOWLEDGE_ERROR', () => {
        const sessionId = 'idle-ack-' + Date.now()
        instanceStateManager.setState(sessionId, 'idle')

        const newState = instanceStateManager.transition(sessionId, 'ACKNOWLEDGE_ERROR')

        expect(newState).toBe('idle')
      })
    })

    describe('working state transitions', () => {
      it('transitions from working to idle on PROCESS_EXIT', () => {
        const sessionId = 'working-to-idle-' + Date.now()
        instanceStateManager.setState(sessionId, 'working')

        const newState = instanceStateManager.transition(sessionId, 'PROCESS_EXIT')

        expect(newState).toBe('idle')
      })

      it('transitions from working to error on PROCESS_ERROR', () => {
        const sessionId = 'working-to-error-' + Date.now()
        instanceStateManager.setState(sessionId, 'working')

        const newState = instanceStateManager.transition(sessionId, 'PROCESS_ERROR')

        expect(newState).toBe('error')
      })

      it('stays working on SEND_MESSAGE (edge case)', () => {
        const sessionId = 'working-stay-' + Date.now()
        instanceStateManager.setState(sessionId, 'working')

        const newState = instanceStateManager.transition(sessionId, 'SEND_MESSAGE')

        expect(newState).toBe('working')
      })
    })

    describe('error state transitions', () => {
      it('transitions from error to idle on ACKNOWLEDGE_ERROR', () => {
        const sessionId = 'error-to-idle-' + Date.now()
        instanceStateManager.setState(sessionId, 'error')

        const newState = instanceStateManager.transition(sessionId, 'ACKNOWLEDGE_ERROR')

        expect(newState).toBe('idle')
      })

      it('transitions from error to working on SEND_MESSAGE (implicit ack)', () => {
        const sessionId = 'error-to-working-' + Date.now()
        instanceStateManager.setState(sessionId, 'error')

        const newState = instanceStateManager.transition(sessionId, 'SEND_MESSAGE')

        expect(newState).toBe('working')
      })

      it('stays error on PROCESS_EXIT', () => {
        const sessionId = 'error-stay-' + Date.now()
        instanceStateManager.setState(sessionId, 'error')

        const newState = instanceStateManager.transition(sessionId, 'PROCESS_EXIT')

        expect(newState).toBe('error')
      })
    })
  })

  describe('event emission', () => {
    it('emits instance:stateChanged on valid transition', () => {
      const sessionId = 'emit-test-' + Date.now()
      instanceStateManager.setState(sessionId, 'idle')

      instanceStateManager.transition(sessionId, 'SEND_MESSAGE')

      expect(mockEmitToRenderer).toHaveBeenCalledWith('instance:stateChanged', {
        sessionId,
        state: 'working',
        previousState: 'idle'
      })
    })

    it('does not emit event when state does not change', () => {
      const sessionId = 'no-emit-test-' + Date.now()
      instanceStateManager.setState(sessionId, 'idle')

      instanceStateManager.transition(sessionId, 'PROCESS_EXIT') // Invalid transition

      expect(mockEmitToRenderer).not.toHaveBeenCalled()
    })
  })

  describe('transferState', () => {
    it('transfers state from temp ID to real ID', () => {
      const tempId = 'pending-123456'
      const realId = 'real-session-uuid'
      instanceStateManager.setState(tempId, 'working')

      instanceStateManager.transferState(tempId, realId)

      expect(instanceStateManager.getState(tempId)).toBe('idle') // Default for unknown
      expect(instanceStateManager.getState(realId)).toBe('working')
    })

    it('handles transfer when source has no state', () => {
      const tempId = 'nonexistent-temp-' + Date.now()
      const realId = 'real-session-uuid-' + Date.now()

      // Should not throw
      instanceStateManager.transferState(tempId, realId)

      expect(instanceStateManager.getState(realId)).toBe('idle')
    })
  })

  describe('removeSession', () => {
    it('removes session from tracking', () => {
      const sessionId = 'remove-test-' + Date.now()
      instanceStateManager.setState(sessionId, 'error')

      instanceStateManager.removeSession(sessionId)

      expect(instanceStateManager.getState(sessionId)).toBe('idle') // Default
    })
  })

  describe('getSessionsInState', () => {
    it('returns sessions matching the given state', () => {
      const session1 = 'getSessionsInState-1-' + Date.now()
      const session2 = 'getSessionsInState-2-' + Date.now()
      const session3 = 'getSessionsInState-3-' + Date.now()

      instanceStateManager.setState(session1, 'working')
      instanceStateManager.setState(session2, 'idle')
      instanceStateManager.setState(session3, 'working')

      const workingSessions = instanceStateManager.getSessionsInState('working')

      // Check our specific sessions are returned correctly
      expect(workingSessions).toContain(session1)
      expect(workingSessions).toContain(session3)
      expect(workingSessions).not.toContain(session2)
      // At minimum 2 sessions, but may include others from previous tests (singleton)
      expect(workingSessions.length).toBeGreaterThanOrEqual(2)

      // Cleanup our test sessions
      instanceStateManager.removeSession(session1)
      instanceStateManager.removeSession(session2)
      instanceStateManager.removeSession(session3)
    })

    it('filters by state correctly', () => {
      const errorSession = 'getSessionsInState-error-' + Date.now()
      instanceStateManager.setState(errorSession, 'error')

      const errorSessions = instanceStateManager.getSessionsInState('error')
      expect(errorSessions).toContain(errorSession)

      // Cleanup
      instanceStateManager.removeSession(errorSession)
    })
  })
})
