import { z } from 'zod'

export const PresetHandlerNameSchema = z.enum([
  'markDone',
  'queueCycle',
  'deferDuration',
  'setFrontmatter',
  'notify',
])
export type PresetHandlerName = z.infer<typeof PresetHandlerNameSchema>

export const HandlerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('preset'),
    preset: PresetHandlerNameSchema,
    params: z.record(z.string(), z.unknown()).optional(),
  }).readonly(),
  z.object({
    kind: z.literal('script'),
    scriptPath: z.string().min(1),
    params: z.record(z.string(), z.unknown()).optional(),
  }).readonly(),
]).readonly()
export type Handler = z.infer<typeof HandlerSchema>
