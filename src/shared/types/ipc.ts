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

// ============================================================
// Message Send Schemas (Story 3a.2)
// ============================================================

/**
 * Request schema for sending a message to a session.
 * Supports both existing sessions and new session creation.
 */
export const SendMessageSchema = z.object({
  /** Session UUID (generated client-side for new sessions) */
  sessionId: z.string().uuid(),
  /** Message content to send */
  message: z.string().min(1),
  /** Folder path for the session (required for CC spawn) */
  folderPath: z.string().min(1),
  /** True if this is the first message creating a new session */
  isNewSession: z.boolean().optional().default(false)
})

export type SendMessageRequest = z.infer<typeof SendMessageSchema>

/**
 * Response schema for send message operation
 */
export const SendMessageResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional()
})

export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>

// ============================================================
// Streaming Event Schemas (Story 3a-3)
// ============================================================

/**
 * Tool use block for streaming - matches ToolUseBlock in renderer types
 */
export const StreamToolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown())
})

export type StreamToolUseBlock = z.infer<typeof StreamToolUseBlockSchema>

/**
 * Tool result block for streaming - matches ToolResultBlock in renderer types
 */
export const StreamToolResultBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.string(),
  is_error: z.boolean().optional()
})

export type StreamToolResultBlock = z.infer<typeof StreamToolResultBlockSchema>

/**
 * Stream chunk event - text content arriving during streaming
 */
export const StreamChunkEventSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.literal('text'),
  content: z.string(),
  uuid: z.string().uuid().optional()
})

export type StreamChunkEvent = z.infer<typeof StreamChunkEventSchema>

/**
 * Stream tool event - tool call or result during streaming
 */
export const StreamToolEventSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.enum(['tool_use', 'tool_result']),
  toolUse: StreamToolUseBlockSchema.optional(),
  toolResult: StreamToolResultBlockSchema.optional()
})

export type StreamToolEvent = z.infer<typeof StreamToolEventSchema>

/**
 * Stream end event - streaming completed or failed
 */
export const StreamEndEventSchema = z.object({
  sessionId: z.string().uuid(),
  success: z.boolean(),
  error: z.string().optional(),
  aborted: z.boolean().optional(),
  totalTokens: z
    .object({
      input: z.number(),
      output: z.number()
    })
    .optional(),
  costUsd: z.number().optional()
})

export type StreamEndEvent = z.infer<typeof StreamEndEventSchema>

// ============================================================
// Abort Schemas (Story 3a-4)
// ============================================================

/**
 * Request schema for aborting a running CC process.
 * Note: Can reuse TerminateRequestSchema semantics but keeping separate for clarity.
 */
export const AbortRequestSchema = z.object({
  sessionId: z.string().uuid()
})

export type AbortRequest = z.infer<typeof AbortRequestSchema>

/**
 * Response schema for abort operation
 */
export const AbortResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional()
})

export type AbortResponse = z.infer<typeof AbortResponseSchema>
