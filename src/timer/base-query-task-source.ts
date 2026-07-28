import { Temporal } from 'temporal-polyfill'
import type { TaskQueueItem } from '../domain/queue/task-source'
import { TaskQueueItemCycleStatusSchema, TaskQueueItemIdSchema } from '../domain/queue/task-source'
import type { TaskSource } from '../domain/queue/task-source'

/**
 * The exact shape a Bases entry needs to project into a TaskQueueItem —
 * deliberately not the real Bases `BasesEntry` (its typed-property system is
 * for user-configurable properties like focusProperty; these are fixed field
 * names, so reading raw frontmatter directly is simpler and needs no
 * BasesPropertyId resolution). Mirrors VaultFile's minimal-surface rationale
 * in obsidian-file-mutation-port.ts.
 */
export interface BaseQueryEntry {
  readonly path: string
  readonly basename: string
  readonly frontmatter: Record<string, unknown> | undefined
}

const STATUS_KEY = 'routine-status'
const TIME_SPENT_KEY = 'routine-time-spent'
const LAST_CYCLED_KEY = 'routine-last-cycled'
const PRIORITY_KEY = 'routine-priority'

const ZERO_DURATION = Temporal.Duration.from({ seconds: 0 })

function readCycleStatus(frontmatter: Record<string, unknown> | undefined): TaskQueueItem['cycleStatus'] {
  const result = TaskQueueItemCycleStatusSchema.safeParse(frontmatter?.[STATUS_KEY])
  return result.success ? result.data : 'pending'
}

function readTimeSpent(frontmatter: Record<string, unknown> | undefined): Temporal.Duration {
  const value = frontmatter?.[TIME_SPENT_KEY]
  if (typeof value !== 'string') {
    return ZERO_DURATION
  }
  try {
    return Temporal.Duration.from(value)
  }
  catch {
    return ZERO_DURATION
  }
}

function readLastCycledAt(frontmatter: Record<string, unknown> | undefined): Temporal.Instant | null {
  const value = frontmatter?.[LAST_CYCLED_KEY]
  if (typeof value !== 'string') {
    return null
  }
  try {
    return Temporal.Instant.from(value)
  }
  catch {
    return null
  }
}

/** Missing/non-numeric priority sorts as if it were 0 — see design.md decision 6. */
function readPriority(frontmatter: Record<string, unknown> | undefined): number {
  const value = frontmatter?.[PRIORITY_KEY]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toTaskQueueItem(entry: BaseQueryEntry): TaskQueueItem {
  const id = TaskQueueItemIdSchema.parse(entry.path)
  return {
    id,
    sourcePath: entry.path,
    displayName: entry.basename,
    cycleStatus: readCycleStatus(entry.frontmatter),
    timeSpent: readTimeSpent(entry.frontmatter),
    lastCycledAt: readLastCycledAt(entry.frontmatter),
  }
}

/**
 * A TaskSource backed by already-filtered Bases entries. Stateless projection
 * — callers (RoutineTimerView) construct a fresh one whenever the view's
 * live query data changes and register it with a TaskSourceRegistry.
 */
export function createBaseQuerySource(entries: readonly BaseQueryEntry[]): TaskSource {
  return {
    getQueue: () => entries
      .map((entry, index) => ({ item: toTaskQueueItem(entry), priority: readPriority(entry.frontmatter), index }))
      .sort((a, b) => a.priority - b.priority || a.index - b.index)
      .map(({ item }) => item),
  }
}
