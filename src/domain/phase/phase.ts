import { z } from 'zod'
import { PositiveDurationSchema } from '../duration'
import { TaskSourceIdSchema } from '../queue/task-source'
import { CompletionPolicySchema } from '../policy/completion-policy'
import { HookReferenceSchema } from '../hook/hook-reference'
import { NotificationPolicySchema } from '../notification-policy'
import { QueueItemActionSchema } from '../action/queue-item-action'

/**
 * Identifier for a phase within a PhaseGraph. Branded so a PhaseId can't be
 * mixed up with other ids even though all are plain strings underneath.
 */
export const PhaseIdSchema = z.string().min(1).brand<'PhaseId'>()
export type PhaseId = z.infer<typeof PhaseIdSchema>

/**
 * Semantic category of a phase (e.g. focus, break, warm-up). Deliberately an
 * open string rather than a fixed enum — a routine's graph may define
 * categories beyond focus/break (a workout has warm-up/set/rest, a standup
 * has per-person turns), so this must not force everything into two buckets.
 */
export const PhaseKindSchema = z.string().min(1).brand<'PhaseKind'>()
export type PhaseKind = z.infer<typeof PhaseKindSchema>

/**
 * Name of a write-back target resolver looked up in a LogTargetResolverRegistry.
 * Never eval'd from settings/frontmatter — always a lookup against code the
 * plugin (or a registering third party) actually shipped.
 */
export const LogTargetResolverNameSchema = z.string().min(1).brand<'LogTargetResolverName'>()
export type LogTargetResolverName = z.infer<typeof LogTargetResolverNameSchema>

/**
 * Where a completed phase's write-back goes: the engine's active queue item,
 * or a named callback resolved via a LogTargetResolverRegistry (e.g. a
 * stretch break has no active item at all, so completion logs against
 * whatever the named resolver — e.g. a future daily-note resolver — returns).
 */
export const PhaseLogTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('activeItem') }),
  z.object({ kind: z.literal('callback'), name: LogTargetResolverNameSchema }),
]).readonly()
export type PhaseLogTarget = z.infer<typeof PhaseLogTargetSchema>

export const TimeFormatSchema = z.enum(['mm:ss', 'hh:mm:ss', 'ss.s', 'ms'])
export type TimeFormat = z.infer<typeof TimeFormatSchema>

/**
 * A single named stage in a routine. Phases are generic — they have no
 * semantic meaning baked in beyond `kind`. The Pomodoro technique is one
 * concrete application of a phase graph.
 */
export const PhaseSchema = z.object({
  /** Unique identifier for this phase within its graph. */
  id: PhaseIdSchema,
  /** Human-readable label shown in the UI. */
  label: z.string().min(1),
  /** Semantic category of this phase, e.g. focus, break, warm-up. */
  kind: PhaseKindSchema,
  /** Duration of this phase, or null for manual/until-dismissed phases (e.g. rep-based exercises). */
  duration: PositiveDurationSchema.nullable(),
  /** The TaskSource this phase pulls its queue from, or null for phases with no queue at all. */
  taskSourceId: TaskSourceIdSchema.nullable(),
  /** What happens when this phase ends, or null for phases with no completion semantics (e.g. a standup turn). */
  completionPolicy: CompletionPolicySchema.nullable(),
  /** Per-phase sound/notification config, or null to use no notification. */
  notification: NotificationPolicySchema.nullable(),
  /** Where completion write-back goes when there's no active queue item. */
  logTarget: PhaseLogTargetSchema,
  /** Hook fired when this phase becomes active. */
  onEnter: HookReferenceSchema.nullable(),
  /** Hook fired when this phase completes (naturally or manually cleared). */
  onComplete: HookReferenceSchema.nullable(),
  /** Hook fired when this phase is skipped rather than completed. */
  onSkip: HookReferenceSchema.nullable(),
  /** Hook fired when this phase stops being active, regardless of how it ended. */
  onExit: HookReferenceSchema.nullable(),
  /** Custom interactive actions available on active queue items during this phase. */
  actions: z.array(QueueItemActionSchema).optional().default([]),
  /** Time display format override for countdown timer rendering. */
  timeFormat: TimeFormatSchema.optional(),
  /** Optional theme/styling CSS class applied to containers during this phase. */
  cssClass: z.string().optional(),
}).readonly()

export type Phase = z.infer<typeof PhaseSchema>
