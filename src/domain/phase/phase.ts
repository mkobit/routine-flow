import { z } from 'zod'
import { PositiveDurationSchema } from '../duration'
import { TaskSourceIdSchema } from '../queue/task-source'
import { QueueItemActionSchema } from '../action/queue-item-action'
import { HandlerSchema } from '../handler/handler'
import type { Handler } from '../handler/handler'
import { NotificationPolicySchema } from '../notification-policy'

/**
 * Identifier for a phase within a PhaseGraph.
 */
export const PhaseIdSchema = z.string().min(1).brand<'PhaseId'>()
export type PhaseId = z.infer<typeof PhaseIdSchema>

/**
 * Semantic category of a phase.
 */
export const PhaseKindSchema = z.string().min(1).brand<'PhaseKind'>()
export type PhaseKind = z.infer<typeof PhaseKindSchema>

/**
 * Name of a write-back target resolver looked up in a LogTargetResolverRegistry.
 */
export const LogTargetResolverNameSchema = z.string().min(1).brand<'LogTargetResolverName'>()
export type LogTargetResolverName = z.infer<typeof LogTargetResolverNameSchema>

/**
 * Where a completed phase's write-back goes.
 */
export const PhaseLogTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('activeItem') }).readonly(),
  z.object({ kind: z.literal('callback'), name: LogTargetResolverNameSchema }).readonly(),
]).readonly()
export type PhaseLogTarget = z.infer<typeof PhaseLogTargetSchema>

export const TimeFormatSchema = z.enum(['mm:ss', 'hh:mm:ss', 'ss.s', 'ms'])
export type TimeFormat = z.infer<typeof TimeFormatSchema>

export const PhaseNodeHandlersSchema = z.object({
  onEnter: z.array(HandlerSchema).readonly().default([]),
  onComplete: z.array(HandlerSchema).readonly().default([]),
  onSkip: z.array(HandlerSchema).readonly().default([]),
  onExit: z.array(HandlerSchema).readonly().default([]),
}).readonly()
export type PhaseNodeHandlers = z.infer<typeof PhaseNodeHandlersSchema>

function getRawRecord(val: unknown): Record<string, unknown> | null {
  return typeof val === 'object' && val !== null ? Object(val) : null
}

function mapHook(hook: unknown): readonly Handler[] {
  const record = getRawRecord(hook)
  const name = record && typeof record.name === 'string' ? record.name : null
  const params = record && typeof record.params === 'object' && record.params !== null ? getRawRecord(record.params) ?? undefined : undefined
  return name !== null ? [{ kind: 'script', scriptPath: name, params }] : []
}

function extractHandlers(raw: Record<string, unknown>): unknown {
  return raw.handlers ?? {
    onEnter: mapHook(raw.onEnter),
    onComplete: mapHook(raw.onComplete),
    onSkip: mapHook(raw.onSkip),
    onExit: mapHook(raw.onExit),
  }
}

/**
 * A single named node stage in a routine graph.
 */
export const PhaseNodeSchema = z.preprocess((val) => {
  const raw = getRawRecord(val)
  const name = raw ? (typeof raw.name === 'string' ? raw.name : (typeof raw.label === 'string' ? raw.label : undefined)) : undefined
  const label = raw && typeof raw.label === 'string' ? raw.label : name
  const taskSourceId = raw ? (raw.taskSourceId !== undefined ? raw.taskSourceId : (raw.taskSource !== undefined ? raw.taskSource : null)) : null
  const completionPolicy = raw ? getRawRecord(raw.completionPolicy) : null
  const onCompletion = raw ? (raw.onCompletion ?? (completionPolicy?.kind === 'manualClear' ? 'waitForManual' : 'autoAdvance')) : 'autoAdvance'
  const handlers = raw ? extractHandlers(raw) : undefined

  return raw
    ? {
        ...raw,
        name,
        label,
        taskSourceId,
        onCompletion,
        handlers,
      }
    : val
}, z.object({
  id: PhaseIdSchema,
  name: z.string().min(1),
  label: z.string().min(1),
  kind: PhaseKindSchema.default(PhaseKindSchema.parse('focus')),
  duration: PositiveDurationSchema.nullable(),
  onCompletion: z.enum(['autoAdvance', 'waitForManual']).default('autoAdvance'),
  taskSourceId: TaskSourceIdSchema.nullable().default(null),
  notification: NotificationPolicySchema.nullable().optional().default(null),
  logTarget: PhaseLogTargetSchema.nullable().default(null),
  handlers: PhaseNodeHandlersSchema.default({
    onEnter: [],
    onComplete: [],
    onSkip: [],
    onExit: [],
  }),
  actions: z.array(QueueItemActionSchema).readonly().optional().default([]),
  timeFormat: TimeFormatSchema.optional(),
  cssClass: z.string().optional(),
}).readonly()).readonly()

export type PhaseNode = z.infer<typeof PhaseNodeSchema>
export const PhaseSchema = PhaseNodeSchema
export type Phase = PhaseNode
