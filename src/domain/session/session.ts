import { z } from 'zod'
import { Temporal } from 'temporal-polyfill'
import type { Phase, PhaseId, PhaseKind } from '../phase/phase'
import type { PhaseGraphId } from '../phase/phase-graph'
import type { TaskQueueItemId } from '../queue/task-source'
import type { FileMutation } from '../mutation/file-mutation'

/** Identifier for a single traversal of a PhaseGraph. */
export const SessionIdSchema = z.string().min(1).brand<'SessionId'>()
export type SessionId = z.infer<typeof SessionIdSchema>

/** Identifier for one concrete occurrence of a phase within a session. */
export const PhaseInstanceIdSchema = z.string().min(1).brand<'PhaseInstanceId'>()
export type PhaseInstanceId = z.infer<typeof PhaseInstanceIdSchema>

/** How a phase instance ended. */
export type PhaseInstanceEndReason = 'completed' | 'skipped' | 'abandoned'

/**
 * A lightweight snapshot of a TaskQueueItem, captured at the moment it becomes a PhaseInstance's
 * active item. Deliberately excludes the mutable cycleStatus/timeSpent/lastCycledAt — a bare
 * TaskQueueItemId from a live, mutable Bases-query-backed queue isn't guaranteed re-resolvable
 * later (the note can be renamed, moved, or drop out of the query).
 */
export interface ItemTouch {
  readonly id: TaskQueueItemId
  readonly sourcePath: string
  readonly displayName: string
}

/**
 * A concrete occurrence of a Phase within a Session. `phaseDisplayName`/`phaseKind` are
 * snapshotted from the firing Phase at open time (alongside `plannedDuration`), so a closed
 * instance survives that Phase later being renamed, re-kinded, or deleted. The current active
 * item is the tail of `itemsTouched`, when non-empty — not separately tracked.
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
  }
}

/**
 * Closes an in-progress PhaseInstance: stamps its end fields, leaving everything else untouched.
 * `actualDuration` is the wall-clock span from `startedAt` to `now`, inclusive of any time spent
 * paused -- EngineState carries no separate paused-time accumulator, so a tick-derived
 * excluding-pauses figure isn't available to compute here.
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
