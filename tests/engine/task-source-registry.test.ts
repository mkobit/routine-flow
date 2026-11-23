import { test, expect, describe } from 'bun:test'
import { TaskQueueItemIdSchema, TaskSourceIdSchema } from '../../src/domain/queue/task-source'
import type { TaskQueueItem, TaskSource } from '../../src/domain/queue/task-source'
import { createTaskSourceRegistry } from '../../src/timer/task-source-registry'

const fakeItem = (path: string): TaskQueueItem => ({
  id: TaskQueueItemIdSchema.parse(path),
  sourcePath: path,
  displayName: path,
  cycleStatus: 'pending',
  timeSpent: Temporal.Duration.from({ seconds: 0 }),
  lastCycledAt: null,
})

const fakeSource = (queue: ReturnType<TaskSource['getQueue']> = []): TaskSource => ({ getQueue: () => queue })

describe('MutableTaskSourceRegistry', () => {
  test('resolving an unregistered id returns undefined', () => {
    const registry = createTaskSourceRegistry()

    expect(registry.resolve(TaskSourceIdSchema.parse('missing'))).toBeUndefined()
  })

  test('resolving a registered id returns its TaskSource', () => {
    const registry = createTaskSourceRegistry()
    const id = TaskSourceIdSchema.parse('focus-queue')
    const source = fakeSource()

    registry.register(id, source)

    expect(registry.resolve(id)).toBe(source)
  })

  test('re-registering the same id overwrites the previous TaskSource', () => {
    const registry = createTaskSourceRegistry()
    const id = TaskSourceIdSchema.parse('focus-queue')
    const first = fakeSource()
    const second = fakeSource()

    registry.register(id, first)
    registry.register(id, second)

    expect(registry.resolve(id)).toBe(second)
  })

  test('unregistering an id makes it resolve to undefined again', () => {
    const registry = createTaskSourceRegistry()
    const id = TaskSourceIdSchema.parse('focus-queue')

    registry.register(id, fakeSource())
    registry.unregister(id)

    expect(registry.resolve(id)).toBeUndefined()
  })

  test('distinct scopes registering the same id do not overwrite each other and merge deduplicated items', () => {
    const registry = createTaskSourceRegistry()
    const id = TaskSourceIdSchema.parse('focus-queue')
    const viewA = { view: 'A' }
    const viewB = { view: 'B' }
    const item1 = fakeItem('tasks/one.md')
    const item2 = fakeItem('tasks/two.md')
    const item3 = fakeItem('tasks/three.md')

    registry.register(id, fakeSource([item1, item2]), viewA)
    registry.register(id, fakeSource([item2, item3]), viewB)

    const resolved = registry.resolve(id)
    expect(resolved?.getQueue()).toEqual([item1, item2, item3])

    // Updating viewA preserves viewB's items.
    registry.register(id, fakeSource([item1]), viewA)
    expect(registry.resolve(id)?.getQueue()).toEqual([item1, item2, item3])

    // Unregistering viewB leaves viewA intact.
    registry.unregisterScope(viewB)
    expect(registry.resolve(id)?.getQueue()).toEqual([item1])

    // Unregistering viewA clears the id completely.
    registry.unregister(id, viewA)
    expect(registry.resolve(id)).toBeUndefined()
  })

  test('subscribe notifies once per mutation and stops after unsubscribe', () => {
    const registry = createTaskSourceRegistry()
    const id = TaskSourceIdSchema.parse('focus-queue')
    const scope = { view: 'A' }
    let notifications = 0
    const unsubscribe = registry.subscribe(() => {
      notifications += 1
    })

    registry.register(id, fakeSource([fakeItem('tasks/one.md')]), scope)
    expect(notifications).toBe(1)

    // Unregistering a missing scope or id does not notify.
    registry.unregister(id, { view: 'missing' })
    registry.unregisterScope({ view: 'missing' })
    expect(notifications).toBe(1)

    registry.unregister(id, scope)
    expect(notifications).toBe(2)

    registry.register(id, fakeSource([fakeItem('tasks/two.md')]), scope)
    expect(notifications).toBe(3)

    registry.unregisterScope(scope)
    expect(notifications).toBe(4)

    registry.notifyChanged()
    expect(notifications).toBe(5)

    unsubscribe()
    registry.register(id, fakeSource(), scope)
    expect(notifications).toBe(5)
  })

  test('replaceScope atomically swaps entries for a scope, preserves other scopes, and notifies once', () => {
    const registry = createTaskSourceRegistry()
    const focusId = TaskSourceIdSchema.parse('focus-queue')
    const breakId = TaskSourceIdSchema.parse('break-queue')
    const reviewId = TaskSourceIdSchema.parse('review-queue')
    const viewA = { view: 'A' }
    const viewB = { view: 'B' }
    const itemA1 = fakeItem('tasks/a1.md')
    const itemB1 = fakeItem('tasks/b1.md')
    const itemBreak = fakeItem('tasks/break.md')
    const itemReview = fakeItem('tasks/review.md')

    registry.register(focusId, fakeSource([itemA1]), viewA)
    registry.register(breakId, fakeSource([itemBreak]), viewA)
    registry.register(focusId, fakeSource([itemB1]), viewB)

    let notifications = 0
    registry.subscribe(() => {
      notifications += 1
    })

    registry.replaceScope(
      viewA,
      new Map([
        [focusId, fakeSource([itemA1])],
        [reviewId, fakeSource([itemReview])],
      ]),
    )

    expect(notifications).toBe(1)
    expect(registry.resolve(breakId)).toBeUndefined()
    expect(registry.resolve(reviewId)?.getQueue()).toEqual([itemReview])
    expect(registry.resolve(focusId)?.getQueue()).toEqual([itemB1, itemA1])
  })
})
