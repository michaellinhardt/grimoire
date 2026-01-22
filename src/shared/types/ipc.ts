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
