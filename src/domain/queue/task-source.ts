import { z } from 'zod'
import type { Temporal } from 'temporal-polyfill'

/** Identifier for a configured TaskSource, referenced from Phase.taskSourceId and resolved via TaskSourceRegistry. */
export const TaskSourceIdSchema = z.string().min(1).brand<'TaskSourceId'>()
export type TaskSourceId = z.infer<typeof TaskSourceIdSchema>

/** Identifier for a task queue item, independent of where it was sourced from. */
export const TaskQueueItemIdSchema = z.string().min(1).brand<'TaskQueueItemId'>()
export type TaskQueueItemId = z.infer<typeof TaskQueueItemIdSchema>

/**
 * Where an item sits in its cycle. 'deferred' (distinct from 'skipped')
 * covers the spaced-repetition case: the item isn't done, but shouldn't come
 * up again until some future date written to its frontmatter.
 */
export const TaskQueueItemCycleStatusSchema = z.enum(['pending', 'active', 'done', 'skipped', 'deferred'])
export type TaskQueueItemCycleStatus = z.infer<typeof TaskQueueItemCycleStatusSchema>

/**
 * Optional additional properties projected from source frontmatter or metadata.
 * Kept generic to prevent routine-specific concepts (such as scores or tags)
 * from coupling to the core domain queue model.
 */
export type TaskQueueItemExtraProperties = Readonly<Record<string, unknown>>

/**
 * A task pulled from a TaskSource, projected into the shape the engine needs.
 * Queue reordering (e.g. "cycle to back") is a mutation on a persisted
 * priority field, not a reorder of the live query itself — a live Base query
 * can't be reordered in place.
 */
export interface TaskQueueItem {
  readonly id: TaskQueueItemId
  readonly sourcePath: string
  readonly displayName: string
  readonly cycleStatus: TaskQueueItemCycleStatus
  readonly timeSpent: Temporal.Duration
  readonly lastCycledAt: Temporal.Instant | null
  readonly extraProperties?: TaskQueueItemExtraProperties
}

/**
 * Extension point: abstraction over where a phase's items come from.
 * Optional per-Phase, not core to Phase — several use cases (stretch
 * routine, standup) have no queue at all. BaseQuerySource (src/timer/) is the
 * concrete Bases-backed implementation; see openspec/changes/archive's
 * base-query-task-source change (once archived) for the design.
 */
export interface TaskSource {
  readonly getQueue: () => readonly TaskQueueItem[]
}

/**
 * Resolves a TaskSource by id. Resolve-only, matching HookRegistry/
 * PredicateRegistry's shape — mutability (register/unregister) lives in a
 * wider src/timer/-local type, since only the Obsidian-integration layer
 * needs to keep a baseQuery source's contents fresh as Bases live-query data
 * changes.
 */
export interface TaskSourceRegistry {
  readonly resolve: (id: TaskSourceId) => TaskSource | undefined
}
