import { describe, expect, it } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import {
  createMulberry32,
  selectRandomQueueItem,
  createDecelerationSchedule,
} from '../../../src/domain/queue/random-task-selector'
import type { TaskQueueItem } from '../../../src/domain/queue/task-source'
import { TaskQueueItemIdSchema } from '../../../src/domain/queue/task-source'

function createTestTask(id: string, sourcePath: string, cycleStatus: TaskQueueItem['cycleStatus'] = 'pending'): TaskQueueItem {
  return {
    id: TaskQueueItemIdSchema.parse(id),
    sourcePath,
    displayName: `Task ${id}`,
    cycleStatus,
    timeSpent: Temporal.Duration.from({ minutes: 5 }),
    lastCycledAt: null,
  }
}

describe('createMulberry32', () => {
  it('generates deterministic float sequence in [0, 1) for the same seed', () => {
    const prng1 = createMulberry32(12_345)
    const prng2 = createMulberry32(12_345)

    const seq1 = [prng1(), prng1(), prng1(), prng1()]
    const seq2 = [prng2(), prng2(), prng2(), prng2()]

    expect(seq1).toEqual(seq2)
    for (const val of seq1) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })

  it('generates different sequences for different seeds', () => {
    const prng1 = createMulberry32(1)
    const prng2 = createMulberry32(2)

    expect(prng1()).not.toBe(prng2())
  })
})

describe('selectRandomQueueItem', () => {
  it('returns null for an empty queue', () => {
    const item = selectRandomQueueItem([])
    expect(item).toBeNull()
  })

  it('returns the single candidate when only one eligible item exists', () => {
    const task = createTestTask('1', 'notes/1.md')
    const selected = selectRandomQueueItem([task])
    expect(selected).toBe(task)
  })

  it('defaults to only allowing pending and active statuses', () => {
    const doneTask = createTestTask('1', 'notes/done.md', 'done')
    const skippedTask = createTestTask('2', 'notes/skipped.md', 'skipped')
    const deferredTask = createTestTask('3', 'notes/deferred.md', 'deferred')

    expect(selectRandomQueueItem([doneTask, skippedTask, deferredTask])).toBeNull()

    const pendingTask = createTestTask('4', 'notes/pending.md', 'pending')
    const activeTask = createTestTask('5', 'notes/active.md', 'active')

    const selected = selectRandomQueueItem([doneTask, pendingTask, activeTask], {
      rng: () => 0,
    })
    expect(selected).toBe(pendingTask)
  })

  it('respects custom allowedStatuses override', () => {
    const doneTask = createTestTask('1', 'notes/done.md', 'done')
    const selected = selectRandomQueueItem([doneTask], {
      allowedStatuses: ['done'],
    })
    expect(selected).toBe(doneTask)
  })

  it('excludes tasks whose sourcePath matches excludePaths', () => {
    const taskA = createTestTask('A', 'notes/a.md')
    const taskB = createTestTask('B', 'notes/b.md')

    const selected = selectRandomQueueItem([taskA, taskB], {
      excludePaths: ['notes/a.md'],
    })
    expect(selected).toBe(taskB)

    const allExcluded = selectRandomQueueItem([taskA, taskB], {
      excludePaths: ['notes/a.md', 'notes/b.md'],
    })
    expect(allExcluded).toBeNull()
  })

  it('uniformly distributes selections across candidates using deterministic RNG', () => {
    const tasks = [
      createTestTask('1', 'notes/1.md'),
      createTestTask('2', 'notes/2.md'),
      createTestTask('3', 'notes/3.md'),
    ]

    const prng = createMulberry32(42)
    const iterations = 3000

    const counts = Array.from({ length: iterations }).reduce<Readonly<Record<string, number>>>(
      (acc) => {
        const selected = selectRandomQueueItem(tasks, { rng: prng })
        return selected !== null
          ? { ...acc, [selected.id]: (acc[selected.id] ?? 0) + 1 }
          : acc
      },
      {},
    )

    // With 3000 iterations and 3 tasks, each should roughly be around 1000 (+- 150)
    for (const task of tasks) {
      const count = counts[task.id] ?? 0
      expect(count).toBeGreaterThan(850)
      expect(count).toBeLessThan(1150)
    }
  })
})

describe('createDecelerationSchedule', () => {
  const minInterval = Temporal.Duration.from({ milliseconds: 50 })
  const maxInterval = Temporal.Duration.from({ milliseconds: 800 })

  it('returns empty array when totalSteps is 0 or negative', () => {
    expect(createDecelerationSchedule({ totalSteps: 0, minInterval, maxInterval })).toEqual([])
    expect(createDecelerationSchedule({ totalSteps: -5, minInterval, maxInterval })).toEqual([])
  })

  it('returns a single maxInterval step when totalSteps is 1', () => {
    const schedule = createDecelerationSchedule({ totalSteps: 1, minInterval, maxInterval })
    expect(schedule).toHaveLength(1)
    expect(schedule[0]).toEqual({
      index: 0,
      interval: maxInterval,
      intervalMs: 800,
    })
  })

  it('produces monotonically increasing intervals ending at maxInterval', () => {
    const schedule = createDecelerationSchedule({
      totalSteps: 10,
      minInterval,
      maxInterval,
      exponent: 2,
    })

    expect(schedule).toHaveLength(10)
    const first = schedule[0]
    const last = schedule[9]
    expect(first?.intervalMs).toBe(50)
    expect(last?.intervalMs).toBe(800)

    for (let i = 1; i < schedule.length; i++) {
      const current = schedule[i]
      const prev = schedule[i - 1]
      expect(current).toBeDefined()
      expect(prev).toBeDefined()
      if (current && prev) {
        expect(current.intervalMs).toBeGreaterThan(prev.intervalMs)
        expect(current.index).toBe(i)
        expect(current.interval.total({ unit: 'millisecond' })).toBe(current.intervalMs)
      }
    }
  })

  it('handles minInterval equals maxInterval gracefully', () => {
    const schedule = createDecelerationSchedule({
      totalSteps: 4,
      minInterval,
      maxInterval: minInterval,
    })

    expect(schedule).toHaveLength(4)
    for (const step of schedule) {
      expect(step.intervalMs).toBe(50)
    }
  })

  it('throws an error if minInterval exceeds maxInterval', () => {
    expect(() => {
      createDecelerationSchedule({
        totalSteps: 5,
        minInterval: maxInterval,
        maxInterval: minInterval,
      })
    }).toThrow()
  })

  it('throws an error if minInterval is negative', () => {
    expect(() => {
      createDecelerationSchedule({
        totalSteps: 5,
        minInterval: Temporal.Duration.from({ milliseconds: -10 }),
        maxInterval,
      })
    }).toThrow()
  })
})
