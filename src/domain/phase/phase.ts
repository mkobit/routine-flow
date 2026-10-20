import { z } from 'zod'
import { Temporal } from 'temporal-polyfill'
import type { BasesPropertyId } from 'obsidian'
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

export const FOCUS_PHASE_KIND = PhaseKindSchema.parse('focus')
export const BREAK_PHASE_KIND = PhaseKindSchema.parse('break')
export const SELECTOR_PHASE_KIND = PhaseKindSchema.parse('selector')

/**
 * Configuration for dedicated task selector phases.
 */
export const PhaseSelectorConfigSchema = z.object({
  autoSpin: z.boolean().default(false),
  promoteToFront: z.boolean().default(false),
}).readonly()
export type PhaseSelectorConfig = z.infer<typeof PhaseSelectorConfigSchema>

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

/**
 * Schema validating and parsing a valid BasesPropertyId string (`note.${string}` | `file.${string}` | `formula.${string}`).
 */
export const PropertyIdSchema = z.custom<BasesPropertyId>(
  val => typeof val === 'string' && (val.startsWith('note.') || val.startsWith('file.') || val.startsWith('formula.')),
  { message: 'Expected a BasesPropertyId prefixed with note., file., or formula.' },
)
export type PropertyId = BasesPropertyId

function normalizePropertyId(rawProp: unknown): unknown {
  return typeof rawProp !== 'string' || rawProp.length === 0
    ? rawProp
    : rawProp.startsWith('note.') || rawProp.startsWith('file.') || rawProp.startsWith('formula.')
      ? rawProp
      : `note.${rawProp}`
}

/**
 * Filter criteria specifying property and expected value for task queue candidates.
 */
export const PhaseQueryFilterSchema = z.preprocess((val) => {
  const raw = getRawRecord(val)
  return raw
    ? {
        ...raw,
        property: normalizePropertyId(raw.property),
      }
    : val
}, z.object({
  property: PropertyIdSchema,
  value: z.string(),
}).readonly()).readonly()
export type PhaseQueryFilter = z.infer<typeof PhaseQueryFilterSchema>

export const PhaseQueueBadgeSchema = z.object({
  property: z.string().min(1),
  label: z.string().min(1).optional(),
  icon: z.string().min(1).optional(),
  prefix: z.string().min(1).optional(),
  suffix: z.string().min(1).optional(),
  variant: z.enum(['default', 'accent', 'muted']).default('default'),
}).readonly()
export type PhaseQueueBadge = z.infer<typeof PhaseQueueBadgeSchema>

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

function extractSelector(raw: Record<string, unknown>): unknown {
  return raw.selector === null
    ? undefined
    : raw.selector !== undefined
      ? raw.selector
      : raw.autoSpin !== undefined || raw.promoteToFront !== undefined
        ? {
            autoSpin: raw.autoSpin,
            promoteToFront: raw.promoteToFront,
          }
        : undefined
}

function parseDurationLike(val: unknown): unknown {
  try {
    return typeof val === 'string'
      ? Temporal.Duration.from(val)
      : typeof val === 'object' && val !== null && !(val instanceof Temporal.Duration)
        ? Temporal.Duration.from(val)
        : val
  }
  catch {
    return val
  }
}

function extractDuration(raw: Record<string, unknown>): unknown {
  return typeof raw.duration === 'string' || (typeof raw.duration === 'object' && raw.duration !== null && !(raw.duration instanceof Temporal.Duration))
    ? parseDurationLike(raw.duration)
    : raw.duration
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
  const selector = raw ? extractSelector(raw) : undefined
  const duration = raw ? extractDuration(raw) : undefined

  return raw
    ? {
        ...raw,
        name,
        label,
        taskSourceId,
        onCompletion,
        handlers,
        selector,
        duration,
      }
    : val
}, z.object({
  id: PhaseIdSchema,
  name: z.string().min(1),
  label: z.string().min(1),
  kind: PhaseKindSchema.default(FOCUS_PHASE_KIND),
  duration: PositiveDurationSchema.nullable(),
  onCompletion: z.enum(['autoAdvance', 'waitForManual']).default('autoAdvance'),
  taskSourceId: TaskSourceIdSchema.nullable().default(null),
  queryFilter: PhaseQueryFilterSchema.optional(),
  notification: NotificationPolicySchema.nullable().optional().default(null),
  logTarget: PhaseLogTargetSchema.nullable().default(null),
  handlers: PhaseNodeHandlersSchema.default({
    onEnter: [],
    onComplete: [],
    onSkip: [],
    onExit: [],
  }),
  actions: z.array(QueueItemActionSchema).readonly().optional().default([]),
  badges: z.array(PhaseQueueBadgeSchema).readonly().optional().default([]),
  timeFormat: TimeFormatSchema.optional(),
  selector: PhaseSelectorConfigSchema.optional(),
}).readonly()).readonly()

export type PhaseNode = z.infer<typeof PhaseNodeSchema>
export const PhaseSchema = PhaseNodeSchema
export type Phase = PhaseNode
