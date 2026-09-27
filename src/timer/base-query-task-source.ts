import { Temporal } from 'temporal-polyfill'
import type { TaskQueueItem, TaskSource } from '../domain/queue/task-source'
import { TaskQueueItemCycleStatusSchema, TaskQueueItemIdSchema } from '../domain/queue/task-source'

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

export const REVIEW_DATE_KEYS = [
  'routine-due',
  'next-review',
  'routine-deferred-until',
  'due',
  'dueDate',
] as const

const ZERO_DURATION = Temporal.Duration.from({ seconds: 0 })

function hasGetTime(value: object): value is { readonly getTime: () => number } {
  return 'getTime' in value && typeof value.getTime === 'function'
}

export function parseTemporalInstant(value: unknown): Temporal.Instant | null {
  if (value === null || value === undefined) {
    return null
  }
  if (value instanceof Temporal.Instant) {
    return value
  }
  if (value instanceof Temporal.ZonedDateTime) {
    return value.toInstant()
  }
  if (value instanceof Temporal.PlainDate) {
    return value.toZonedDateTime('UTC').toInstant()
  }
  if (value instanceof Temporal.PlainDateTime) {
    return value.toZonedDateTime('UTC').toInstant()
  }
  if (typeof value === 'object' && hasGetTime(value)) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? Temporal.Instant.fromEpochMilliseconds(ms) : null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Temporal.Instant.fromEpochMilliseconds(value) : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    try {
      return Temporal.Instant.from(trimmed)
    }
    catch {
      // Continue to next format
    }
    try {
      return Temporal.PlainDateTime.from(trimmed).toZonedDateTime('UTC').toInstant()
    }
    catch {
      // Continue to next format
    }
    try {
      return Temporal.PlainDate.from(trimmed).toZonedDateTime('UTC').toInstant()
    }
    catch {
      return null
    }
  }
  return null
}

export function readReviewDate(frontmatter: Record<string, unknown> | undefined): Temporal.Instant | null {
  if (!frontmatter) {
    return null
  }
  for (const key of REVIEW_DATE_KEYS) {
    const value = frontmatter[key]
    if (value !== undefined) {
      const instant = parseTemporalInstant(value)
      if (instant !== null) {
        return instant
      }
    }
  }
  return null
}

export function resolveNow(now?: Temporal.Instant | (() => Temporal.Instant)): Temporal.Instant {
  if (!now) {
    return Temporal.Now.instant()
  }
  return typeof now === 'function' ? now() : now
}

export function isDeferredInFuture(
  frontmatter: Record<string, unknown> | undefined,
  now: Temporal.Instant,
): boolean {
  if (frontmatter?.[STATUS_KEY] !== 'deferred') {
    return false
  }
  const reviewDate = readReviewDate(frontmatter)
  if (reviewDate === null) {
    return false
  }
  return Temporal.Instant.compare(reviewDate, now) > 0
}

function readCycleStatus(
  frontmatter: Record<string, unknown> | undefined,
  now: Temporal.Instant,
): TaskQueueItem['cycleStatus'] {
  const result = TaskQueueItemCycleStatusSchema.safeParse(frontmatter?.[STATUS_KEY])
  const status = result.success ? result.data : 'pending'
  if (status === 'deferred') {
    const reviewDate = readReviewDate(frontmatter)
    if (reviewDate !== null && Temporal.Instant.compare(reviewDate, now) <= 0) {
      return 'pending'
    }
  }
  return status
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

function toTaskQueueItem(entry: BaseQueryEntry, now: Temporal.Instant): TaskQueueItem {
  const id = TaskQueueItemIdSchema.parse(entry.path)
  return {
    id,
    sourcePath: entry.path,
    displayName: entry.basename,
    cycleStatus: readCycleStatus(entry.frontmatter, now),
    timeSpent: readTimeSpent(entry.frontmatter),
    lastCycledAt: readLastCycledAt(entry.frontmatter),
  }
}

/**
 * A TaskSource backed by already-filtered Bases entries. Stateless projection
 * — callers (RoutineTimerView) construct a fresh one whenever the view's
 * live query data changes and register it with a TaskSourceRegistry.
 */
export function createBaseQuerySource(
  entries: readonly BaseQueryEntry[],
  now?: Temporal.Instant | (() => Temporal.Instant),
): TaskSource {
  return {
    getQueue: () => {
      const evaluationTime = resolveNow(now)
      return entries
        .filter(entry => !isDeferredInFuture(entry.frontmatter, evaluationTime))
        .map((entry, index) => ({
          item: toTaskQueueItem(entry, evaluationTime),
          priority: readPriority(entry.frontmatter),
          index,
        }))
        .sort((a, b) => a.priority - b.priority || a.index - b.index)
        .map(({ item }) => item)
    },
  }
}
