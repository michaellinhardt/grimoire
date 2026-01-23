import { emitToRenderer } from './stream-parser'
import type { InstanceState, StateEvent, InstanceStateChangedEvent } from './types'

/**
 * Manages instance state for all sessions.
 * Implements a 3-state machine: idle -> working -> idle (normal)
 * or idle -> working -> error -> idle (error flow).
 *
 * Emits instance:stateChanged events to renderer on all transitions.
 */
class InstanceStateManager {
  private states = new Map<string, InstanceState>()

  /**
   * Get current state for a session.
   * Defaults to 'idle' if session has no state.
   */
  getState(sessionId: string): InstanceState {
    return this.states.get(sessionId) ?? 'idle'
  }

  /**
   * Directly set state for a session (internal use only).
   * Prefer transition() for validated state changes.
   */
  setState(sessionId: string, state: InstanceState): void {
    this.states.set(sessionId, state)
  }

  /**
   * Attempt a state transition based on an event.
   * Invalid transitions are logged and ignored (defensive).
   *
   * @param sessionId - Session UUID
   * @param event - State transition event
   * @returns New state after transition (may be same as current if invalid)
   */
  transition(sessionId: string, event: StateEvent): InstanceState {
    const currentState = this.getState(sessionId)
    const nextState = this.computeNextState(currentState, event)

    if (nextState !== currentState) {
      this.states.set(sessionId, nextState)

      const payload: InstanceStateChangedEvent = {
        sessionId,
        state: nextState,
        previousState: currentState
      }
      emitToRenderer('instance:stateChanged', payload)
    } else if (process.env.DEBUG_STATE_MACHINE) {
      console.debug(
        `[InstanceStateManager] Ignored transition: ${currentState} + ${event} (no change)`
      )
    }

    return nextState
  }

  /**
   * Compute next state based on current state and event.
   * Implements the state machine logic.
   */
  private computeNextState(current: InstanceState, event: StateEvent): InstanceState {
    switch (current) {
      case 'idle':
        if (event === 'SEND_MESSAGE') return 'working'
        return current

      case 'working':
        if (event === 'PROCESS_EXIT') return 'idle'
        if (event === 'PROCESS_ERROR') return 'error'
        return current

      case 'error':
        if (event === 'ACKNOWLEDGE_ERROR') return 'idle'
        if (event === 'SEND_MESSAGE') return 'working' // Implicit ack
        return current

      default:
        return current
    }
  }

  /**
   * Transfer state from one session ID to another.
   * Used when new sessions get their real ID from CC init event.
   */
  transferState(fromId: string, toId: string): void {
    const state = this.states.get(fromId)
    if (state) {
      this.states.delete(fromId)
      this.states.set(toId, state)
      // No event emission needed - the sessionId changed but state didn't
    }
  }

  /**
   * Remove session from state tracking.
   * Call when session is closed/deleted.
   */
  removeSession(sessionId: string): void {
    this.states.delete(sessionId)
  }

  /**
   * Get all sessions currently in a specific state.
   * Useful for debugging.
   */
  getSessionsInState(state: InstanceState): string[] {
    const result: string[] = []
    for (const [sessionId, sessionState] of this.states) {
      if (sessionState === state) {
        result.push(sessionId)
      }
    }
    return result
  }
}

/** Singleton instance */
export const instanceStateManager = new InstanceStateManager()
