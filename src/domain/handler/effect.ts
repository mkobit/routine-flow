import { z } from 'zod'
import { FileMutationSchema } from '../mutation/file-mutation'

export const NotificationEffectSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  system: z.boolean().optional().default(false),
}).readonly()
export type NotificationEffect = z.infer<typeof NotificationEffectSchema>

export const EffectSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('fileMutation'),
    mutations: z.array(FileMutationSchema).readonly(),
  }).readonly(),
  z.object({
    kind: z.literal('notification'),
    notification: NotificationEffectSchema,
  }).readonly(),
  z.object({
    kind: z.literal('invocationFailed'),
    cause: z.unknown(),
  }).readonly(),
]).readonly()
export type Effect = z.infer<typeof EffectSchema>
