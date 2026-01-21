import { z } from 'zod'

export const SessionIdSchema = z.string().uuid()

export const SpawnRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1),
  folderPath: z.string()
})

export type SpawnRequest = z.infer<typeof SpawnRequestSchema>

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
