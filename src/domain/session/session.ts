import { z } from 'zod'
import type { Phase, PhaseId, PhaseKind } from '../phase/phase'
import type { PhaseGraphId } from '../phase/phase-graph'
import type { TaskQueueItemId } from '../queue/task-source'
import type { FileMutation } from '../mutation/file-mutation'
import type { HookEvent } from '../hook/hook-reference'

/** Identifier for a single traversal of a PhaseGraph. */
export const SessionIdSchema = z.string().min(1).brand<'SessionId'>()
export type SessionId = z.infer<typeof SessionIdSchema>

/** Identifier for one concrete occurrence of a phase within a session. */
export const PhaseInstanceIdSchema = z.string().min(1).brand<'PhaseInstanceId'>()
export type PhaseInstanceId = z.infer<typeof PhaseInstanceIdSchema>

/** How a phase instance ended. */
export type PhaseInstanceEndReason = 'completed' | 'skipped' | 'abandoned'

/**
 * Lightweight snapshot of a `TaskQueueItem` captured when it becomes active.
 * Excludes mutable queue state (`cycleStatus`, `timeSpent`, `lastCycledAt`)
 * since live Bases-query items may rename, move, or leave the query later.
 */
export type ItemTouchStatus = 'viewed' | 'completed'

export interface ItemTouch {
  readonly id: TaskQueueItemId
  readonly sourcePath: string
  readonly displayName: string
  readonly status: ItemTouchStatus
  readonly completedAt: Temporal.Instant | null
}

/**
 * One hook-invocation failure folded onto a PhaseInstance -- either the hook itself
 * threw/rejected (`invocationFailed`), or it returned mutations but one failed to apply
 * (`mutationFailed`, naming that mutation). `event` names which lifecycle moment
 * (onEnter/onComplete/onSkip/onExit) produced it, since more than one event can fire for the
 * same instance.
 */
export type PhaseInstanceHookFailure =
  | { readonly event: HookEvent, readonly kind: 'invocationFailed', readonly cause: unknown }
  | { readonly event: HookEvent, readonly kind: 'mutationFailed', readonly mutation: FileMutation, readonly cause: unknown }

/**
 * A concrete occurrence of a `Phase` within a `Session`. Snapshots display name,
 * kind, and planned duration at open time. The current active item is the tail of
 * `itemsTouched`. `mutationsApplied` and `hookFailures` accumulate across all hook
 * events for this instance in firing order.
 */
export interface PhaseInstance {
  readonly id: PhaseInstanceId
  readonly phaseId: PhaseId
  readonly phaseDisplayName: string
  readonly phaseKind: PhaseKind
  readonly plannedDuration: Temporal.Duration | null
  readonly actualDuration: Temporal.Duration
  readonly startedAt: Temporal.Instant
  readonly endedAt: Temporal.Instant | null
  readonly endReason: PhaseInstanceEndReason | null
  readonly itemsTouched: readonly ItemTouch[]
  readonly mutationsApplied: readonly FileMutation[]
  readonly hookFailures: readonly PhaseInstanceHookFailure[]
}

/**
 * One full traversal of a PhaseGraph, from start until the user stops it. `currentInstance` holds
 * the in-progress PhaseInstance (`endedAt: null`) when one exists; `history` holds only closed
 * instances (non-null `endedAt`) — an in-progress instance never appears in `history`.
 */
export interface Session {
  readonly id: SessionId
  readonly phaseGraphId: PhaseGraphId
  readonly startedAt: Temporal.Instant
  readonly endedAt: Temporal.Instant | null
  readonly currentInstance: PhaseInstance | null
  readonly history: readonly PhaseInstance[]
}

/** Mints a fresh PhaseInstance for `phase` becoming active at `now`. */
export function openPhaseInstance(phase: Phase, now: Temporal.Instant): PhaseInstance {
  return {
    id: PhaseInstanceIdSchema.parse(crypto.randomUUID()),
    phaseId: phase.id,
    phaseDisplayName: phase.label,
    phaseKind: phase.kind,
    plannedDuration: phase.duration,
    actualDuration: Temporal.Duration.from({ seconds: 0 }),
    startedAt: now,
    endedAt: null,
    endReason: null,
    itemsTouched: [],
    mutationsApplied: [],
    hookFailures: [],
  }
}

/**
 * Closes an in-progress `PhaseInstance` at `now`. `actualDuration` is wall-clock
 * time from `startedAt` to `now` (including pauses).
 */
export function closePhaseInstance(instance: PhaseInstance, now: Temporal.Instant, endReason: PhaseInstanceEndReason): PhaseInstance {
  return {
    ...instance,
    endedAt: now,
    endReason,
    actualDuration: now.since(instance.startedAt),
  }
}

/** Opens a fresh Session for a PhaseGraph traversal starting at `phase`. */
export function openSession(phaseGraphId: PhaseGraphId, now: Temporal.Instant, phase: Phase): Session {
  return {
    id: SessionIdSchema.parse(crypto.randomUUID()),
    phaseGraphId,
    startedAt: now,
    endedAt: null,
    currentInstance: openPhaseInstance(phase, now),
    history: [],
  }
}
