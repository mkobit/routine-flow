import { z } from 'zod'
import { Temporal } from 'temporal-polyfill'
import { NonNegativeDurationSchema } from '../duration'
import type { TaskQueueItem, TaskQueueItemCycleStatus } from './task-source'

/** Pure uniform random number generator producing float in [0, 1). */
export type RandomGenerator = (this: void) => number

/**
 * Creates a deterministic 32-bit Mulberry32 PRNG.
 * Produces float values uniformly in [0, 1).
 */
export function createMulberry32(seed: number): RandomGenerator {
  const stateHolder = [(seed | 0) >>> 0]
  return function (this: void): number {
    const currentState = stateHolder[0] ?? 0
    const nextState = (currentState + 0x6D_2B_79_F5) | 0
    Reflect.set(stateHolder, 0, nextState)
    const t1 = Math.imul(nextState ^ (nextState >>> 15), 1 | nextState)
    const t2 = (t1 + Math.imul(t1 ^ (t1 >>> 7), 61 | t1)) ^ t1
    return ((t2 ^ (t2 >>> 14)) >>> 0) / 4_294_967_296
  }
}

const DEFAULT_ALLOWED_STATUSES: readonly TaskQueueItemCycleStatus[] = ['pending', 'active']

export interface SelectRandomQueueItemOptions {
  readonly excludePaths?: readonly string[]
  readonly allowedStatuses?: readonly TaskQueueItemCycleStatus[]
  readonly rng?: RandomGenerator
}

/**
 * Selects a uniform random item from candidate queue items.
 * Returns null if no eligible candidates exist.
 */
export function selectRandomQueueItem(
  items: readonly TaskQueueItem[],
  options?: SelectRandomQueueItemOptions,
): TaskQueueItem | null {
  const allowedStatuses = options?.allowedStatuses ?? DEFAULT_ALLOWED_STATUSES
  const allowedStatusSet = new Set<TaskQueueItemCycleStatus>(allowedStatuses)
  const excludePathSet = new Set<string>(options?.excludePaths ?? [])
  const rng = options?.rng ?? Math.random

  const candidates = items.filter(
    item => allowedStatusSet.has(item.cycleStatus) && !excludePathSet.has(item.sourcePath),
  )

  const rawRng = rng()
  const clampedRng = Math.max(0, Math.min(1 - Number.EPSILON, rawRng))
  const selectedIndex = Math.floor(clampedRng * candidates.length)
  return candidates.length === 0 ? null : (candidates[selectedIndex] ?? null)
}

export interface DecelerationStep {
  readonly index: number
  readonly interval: Temporal.Duration
  readonly intervalMs: number
}

export const DecelerationScheduleOptionsSchema = z.object({
  totalSteps: z.number().int(),
  minInterval: NonNegativeDurationSchema,
  maxInterval: NonNegativeDurationSchema,
  exponent: z.number().positive().default(2),
}).refine(
  data => data.minInterval.total({ unit: 'millisecond' }) <= data.maxInterval.total({ unit: 'millisecond' }),
  { message: 'minInterval cannot exceed maxInterval' },
)

export type DecelerationScheduleOptions = z.input<typeof DecelerationScheduleOptionsSchema>

function calculateStepIntervalMs(
  stepIndex: number,
  totalSteps: number,
  minMs: number,
  maxMs: number,
  exponent: number,
): number {
  const progress = stepIndex / (totalSteps - 1)
  const factor = Math.pow(progress, exponent)
  return Math.round(minMs + (maxMs - minMs) * factor)
}

function buildScheduleSteps(
  totalSteps: number,
  minMs: number,
  maxMs: number,
  exponent: number,
): readonly DecelerationStep[] {
  return Array.from({ length: totalSteps }, (_, i) => {
    const intervalMs = calculateStepIntervalMs(i, totalSteps, minMs, maxMs, exponent)
    return {
      index: i,
      interval: Temporal.Duration.from({ milliseconds: intervalMs }),
      intervalMs,
    }
  })
}

/**
 * Generates an easing schedule with increasing interval durations for roulette animations.
 * When totalSteps <= 0, returns an empty array.
 * Validates constraints via DecelerationScheduleOptionsSchema.parse.
 */
export function createDecelerationSchedule(
  options: DecelerationScheduleOptions,
): readonly DecelerationStep[] {
  const parsed = DecelerationScheduleOptionsSchema.parse(options)
  const totalSteps = parsed.totalSteps
  const minMs = parsed.minInterval.total({ unit: 'millisecond' })
  const maxMs = parsed.maxInterval.total({ unit: 'millisecond' })

  return totalSteps <= 0
    ? []
    : totalSteps === 1
      ? [
          {
            index: 0,
            interval: parsed.maxInterval,
            intervalMs: maxMs,
          },
        ]
      : buildScheduleSteps(totalSteps, minMs, maxMs, parsed.exponent)
}
