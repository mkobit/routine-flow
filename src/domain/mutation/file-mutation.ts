import { z } from 'zod'
import { TaskQueueItemIdSchema, TaskQueueItemCycleStatusSchema } from '../queue/task-source'

/**
 * A hook's description of a vault write to apply, keeping hooks pure and
 * giving the engine a single choke point for applying mutations.
 */
export const FileMutationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('frontmatter'),
    filePath: z.string().min(1),
    property: z.string().min(1),
    value: z.union([z.number(), z.string(), z.boolean()]),
  }),
  z.object({
    kind: z.literal('append'),
    filePath: z.string().min(1),
    text: z.string().min(1),
  }),
  z.object({
    kind: z.literal('queueReorder'),
    itemId: TaskQueueItemIdSchema,
    position: z.enum(['front', 'back']),
  }),
  z.object({
    kind: z.literal('queueStatusChange'),
    itemId: TaskQueueItemIdSchema,
    status: TaskQueueItemCycleStatusSchema,
  }),
]).readonly()

export type FileMutation = z.infer<typeof FileMutationSchema>
