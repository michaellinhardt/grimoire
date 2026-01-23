import { z } from 'zod'

export const SessionIdSchema = z.string().uuid()

export const SpawnRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1),
  folderPath: z.string()
})

export type SpawnRequest = z.infer<typeof SpawnRequestSchema>

export const TerminateRequestSchema = z.object({
  sessionId: z.string().uuid()
})

export type TerminateRequest = z.infer<typeof TerminateRequestSchema>

export const SessionSchema = z.object({
  id: z.string().uuid(),
  folderPath: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastAccessedAt: z.number().nullable(),
  archived: z.boolean(),
  isPinned: z.boolean(),
  forkedFromSessionId: z.string().uuid().nullable(),
  isHidden: z.boolean()
})

export type Session = z.infer<typeof SessionSchema>

export const FolderSchema = z.object({
  path: z.string(),
  isPinned: z.boolean(),
  lastAccessedAt: z.number().nullable()
})

export type Folder = z.infer<typeof FolderSchema>

// ============================================================
// Session Scanning Schemas (Story 2a.1)
// ============================================================

// DiscoveredSession schema - discovered session metadata from scan
export const DiscoveredSessionSchema = z.object({
  id: z.string().uuid(),
  filePath: z.string(),
  folderPath: z.string(),
  createdAt: z.number(),
  updatedAt: z.number()
})

export type DiscoveredSession = z.infer<typeof DiscoveredSessionSchema>

// Request Schemas
export const ScanRequestSchema = z.object({}) // No params needed

export const SyncRequestSchema = z.object({
  sessions: z.array(DiscoveredSessionSchema)
})

export type SyncRequest = z.infer<typeof SyncRequestSchema>

// Response Schemas
export const ScanResultSchema = z.object({
  sessions: z.array(DiscoveredSessionSchema)
})

export type ScanResult = z.infer<typeof ScanResultSchema>

export const SyncResultSchema = z.object({
  added: z.number(),
  updated: z.number(),
  orphaned: z.number(),
  errors: z.array(z.string())
})

export type SyncResult = z.infer<typeof SyncResultSchema>

// SessionWithExists - Session with runtime folder existence check
export const SessionWithExistsSchema = SessionSchema.extend({
  exists: z.boolean() // Runtime folder existence check (not stored in DB)
})

export type SessionWithExists = z.infer<typeof SessionWithExistsSchema>

// Session list response schema
export const SessionListSchema = z.array(SessionWithExistsSchema)

export type SessionList = z.infer<typeof SessionListSchema>

// ============================================================
// Session Management Schemas (Story 2a.3)
// ============================================================

export const CreateSessionSchema = z.object({
  folderPath: z.string().min(1)
})

export type CreateSessionRequest = z.infer<typeof CreateSessionSchema>

// ============================================================
// Session Forking Schemas (Story 2a.5)
// ============================================================

export const ListSessionsOptionsSchema = z.object({
  includeHidden: z.boolean().optional().default(false)
})

export type ListSessionsOptions = z.infer<typeof ListSessionsOptionsSchema>

export const ForkSessionSchema = z.object({
  parentSessionId: z.string().uuid(),
  hideParent: z.boolean().optional().default(true)
})

export type ForkSessionRequest = z.infer<typeof ForkSessionSchema>

export const SessionLineageSchema = z.array(z.string().uuid())

export type SessionLineage = z.infer<typeof SessionLineageSchema>

// ============================================================
// Session Metadata Schemas (Story 2a.6)
// ============================================================

export const SessionMetadataSchema = z.object({
  sessionId: z.string().uuid(),
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
  model: z.string().nullable(),
  updatedAt: z.number().nullable()
})

export type SessionMetadata = z.infer<typeof SessionMetadataSchema>

// For upsert operations - delta values to add to existing totals
export const SessionMetadataUpsertSchema = z.object({
  sessionId: z.string().uuid(),
  inputTokens: z.number().int().nonnegative().optional().default(0),
  outputTokens: z.number().int().nonnegative().optional().default(0),
  costUsd: z.number().nonnegative().optional().default(0),
  model: z.string().optional()
})

export type SessionMetadataUpsert = z.infer<typeof SessionMetadataUpsertSchema>

// ============================================================
// Rewind Schemas (Story 2b.5)
// ============================================================

/**
 * Request schema for rewinding a conversation from a checkpoint.
 * Creates a forked session that will resume from a specific message UUID.
 *
 * Note: This is distinct from ForkSessionSchema which does a simple fork.
 * Rewind stores checkpoint context for Epic 3b CC spawn with --checkpoint flag.
 */
export const RewindRequestSchema = z.object({
  /** Current session ID to rewind from */
  sessionId: z.string().uuid(),
  /** Message UUID to rewind to (checkpoint) */
  checkpointUuid: z.string().uuid(),
  /** New message to send after rewinding */
  newMessage: z.string().trim().min(1, { message: 'Message cannot be empty' })
})

export type RewindRequest = z.infer<typeof RewindRequestSchema>
