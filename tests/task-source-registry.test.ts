import { test, expect, describe } from 'bun:test'
import { TaskQueueItemIdSchema, TaskSourceIdSchema } from '../src/domain/queue/task-source'
import type { TaskQueueItem, TaskSource } from '../src/domain/queue/task-source'
import { createTaskSourceRegistry } from '../src/timer/task-source-registry'

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
})
