import { Temporal } from 'temporal-polyfill'
import { test, expect, describe } from 'bun:test'
import { createBaseQuerySource } from '../src/timer/base-query-task-source'
import type { BaseQueryEntry } from '../src/timer/base-query-task-source'
import { TaskQueueItemIdSchema } from '../src/domain/queue/task-source'

function entry(overrides: Partial<BaseQueryEntry> = {}): BaseQueryEntry {
  return {
    path: 'tasks/write-report.md',
    basename: 'write-report',
    frontmatter: undefined,
    ...overrides,
  }
}

describe('BaseQuerySource', () => {
  test('projects identity fields from path/basename', () => {
    const source = createBaseQuerySource([
      entry({ path: 'tasks/write-report.md', basename: 'write-report' }),
    ])

    const [item] = source.getQueue()

    expect(item?.id).toBe(TaskQueueItemIdSchema.parse('tasks/write-report.md'))
    expect(item?.sourcePath).toBe('tasks/write-report.md')
    expect(item?.displayName).toBe('write-report')
  })

  test('projects cycleStatus/timeSpent/lastCycledAt from frontmatter when present', () => {
    const source = createBaseQuerySource([
      entry({
        frontmatter: {
          'routine-status': 'active',
          'routine-time-spent': 'PT15M',
          'routine-last-cycled': '2026-07-01T12:00:00Z',
        },
      }),
    ])

    const [item] = source.getQueue()

    expect(item?.cycleStatus).toBe('active')
    expect(item?.timeSpent.total({ unit: 'minutes' })).toBe(15)
    expect(item?.lastCycledAt?.equals(Temporal.Instant.from('2026-07-01T12:00:00Z'))).toBe(true)
  })

  test('defaults cycleStatus/timeSpent/lastCycledAt when frontmatter is absent', () => {
    const source = createBaseQuerySource([entry({ frontmatter: undefined })])

    const [item] = source.getQueue()

    expect(item?.cycleStatus).toBe('pending')
    expect(item?.timeSpent.total({ unit: 'seconds' })).toBe(0)
    expect(item?.lastCycledAt).toBeNull()
  })

  test('defaults cycleStatus/timeSpent/lastCycledAt when frontmatter values are malformed', () => {
    const source = createBaseQuerySource([
      entry({
        frontmatter: {
          'routine-status': 'not-a-real-status',
          'routine-time-spent': 'not-a-duration',
          'routine-last-cycled': 'not-an-instant',
        },
      }),
    ])

    const [item] = source.getQueue()

    expect(item?.cycleStatus).toBe('pending')
    expect(item?.timeSpent.total({ unit: 'seconds' })).toBe(0)
    expect(item?.lastCycledAt).toBeNull()
  })

  test('sorts ascending by routine-priority', () => {
    const source = createBaseQuerySource([
      entry({ path: 'b.md', basename: 'b', frontmatter: { 'routine-priority': 10 } }),
      entry({ path: 'a.md', basename: 'a', frontmatter: { 'routine-priority': -5 } }),
      entry({ path: 'c.md', basename: 'c', frontmatter: { 'routine-priority': 0 } }),
    ])

    expect(source.getQueue().map(item => item.sourcePath)).toEqual(['a.md', 'c.md', 'b.md'])
  })

  test('items with no priority sort as if priority were zero, tiebreaking by original order', () => {
    const source = createBaseQuerySource([
      entry({ path: 'front.md', basename: 'front', frontmatter: { 'routine-priority': -5 } }),
      entry({ path: 'untouched-1.md', basename: 'untouched-1', frontmatter: undefined }),
      entry({ path: 'untouched-2.md', basename: 'untouched-2', frontmatter: undefined }),
      entry({ path: 'back.md', basename: 'back', frontmatter: { 'routine-priority': 10 } }),
    ])

    expect(source.getQueue().map(item => item.sourcePath)).toEqual([
      'front.md',
      'untouched-1.md',
      'untouched-2.md',
      'back.md',
    ])
  })
})
