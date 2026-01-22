import type { ChildProcess } from 'child_process'

/**
 * Registry of active child processes mapped by session ID.
 *
 * This is a placeholder that will be populated by Epic 3b (CC Integration & Instance Management)
 * when child process spawning is implemented. The terminate IPC handler and graceful shutdown
 * logic reference this registry to manage child processes.
 *
 * Key: Session UUID (string)
 * Value: ChildProcess instance from Node.js child_process module
 *
 * @see src/main/ipc/sessions.ts - terminate IPC handler
 * @see src/main/index.ts - before-quit graceful shutdown
 */
export const processRegistry = new Map<string, ChildProcess>()
