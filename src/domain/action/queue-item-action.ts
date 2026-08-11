import { z } from 'zod'
import { PositiveDurationSchema } from '../duration'

export const QueueItemActionStyleSchema = z.enum(['default', 'primary', 'destructive'])
export type QueueItemActionStyle = z.infer<typeof QueueItemActionStyleSchema>

export const QueueItemActionPayloadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('queueCycle') }),
  z.object({ kind: z.literal('markDone') }),
  z.object({ kind: z.literal('deferDuration'), after: PositiveDurationSchema }),
  z.object({
    kind: z.literal('setFrontmatter'),
    property: z.string().min(1),
    value: z.union([z.number(), z.string(), z.boolean()]),
  }),
]).readonly()

export type QueueItemActionPayload = z.infer<typeof QueueItemActionPayloadSchema>

export const QueueItemActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  style: QueueItemActionStyleSchema.optional(),
  payload: QueueItemActionPayloadSchema,
}).readonly()

export type QueueItemAction = z.infer<typeof QueueItemActionSchema>
