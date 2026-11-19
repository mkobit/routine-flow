import { describe, expect, test } from 'bun:test'
import { TaskSourceIdSchema } from '../src/domain/queue/task-source'
import { FallbackTaskSourceManager } from '../src/timer/fallback-task-sources'
import { createTaskSourceRegistry } from '../src/timer/task-source-registry'

const focusId = TaskSourceIdSchema.parse('focus-queue')
const breakId = TaskSourceIdSchema.parse('break-queue')

describe('FallbackTaskSourceManager', () => {
  test('retainIfUnprovided registers fallback when no live view is registered, and skips when another scope is still registered', () => {
    const registry = createTaskSourceRegistry()
    const manager = new FallbackTaskSourceManager(registry)
    const liveScope = { view: 'live' }

    // Another live view still provides focusId -> retainIfUnprovided is a no-op.
    registry.register(focusId, { getQueue: () => [] }, liveScope)
    manager.retainIfUnprovided(focusId, {
      entries: [{ path: 'tasks/a.md', basename: 'a', frontmatter: undefined }],
    })
    expect(registry.resolve(focusId)?.getQueue()).toEqual([])

    // Unregistering the live view leaves focusId unprovided -> retainIfUnprovided registers fallback.
    registry.unregisterScope(liveScope)
    manager.retainIfUnprovided(focusId, {
      entries: [{ path: 'tasks/a.md', basename: 'a', frontmatter: undefined }],
    })
    expect(registry.resolve(focusId)?.getQueue().map(i => i.sourcePath)).toEqual(['tasks/a.md'])
  })

  test('clearForSource removes fallback when a live view re-registers', () => {
    const registry = createTaskSourceRegistry()
    const manager = new FallbackTaskSourceManager(registry)

    manager.retainIfUnprovided(focusId, {
      entries: [{ path: 'tasks/a.md', basename: 'a', frontmatter: undefined }],
    })
    expect(registry.resolve(focusId)?.getQueue()).toHaveLength(1)

    manager.clearForSource(focusId)
    expect(registry.resolve(focusId)).toBeUndefined()
  })

  test('clearAll clears all tracked fallback sources when routine stops', () => {
    const registry = createTaskSourceRegistry()
    const manager = new FallbackTaskSourceManager(registry)

    manager.retainIfUnprovided(focusId, {
      entries: [{ path: 'tasks/a.md', basename: 'a', frontmatter: undefined }],
    })
    manager.retainIfUnprovided(breakId, {
      entries: [{ path: 'tasks/b.md', basename: 'b', frontmatter: undefined }],
    })

    manager.clearAll()

    expect(registry.resolve(focusId)).toBeUndefined()
    expect(registry.resolve(breakId)).toBeUndefined()
  })

  test('handleFileChanged updates routine-status, routine-priority, routine-time-spent, and extraProperties, and ignores unrelated files', () => {
    const registry = createTaskSourceRegistry()
    const manager = new FallbackTaskSourceManager(registry)

    manager.retainIfUnprovided(focusId, {
      entries: [
        { path: 'tasks/a.md', basename: 'a', frontmatter: { 'routine-priority': 1, 'estimate': '10m' } },
        { path: 'tasks/b.md', basename: 'b', frontmatter: { 'routine-priority': 2, 'estimate': '5m' } },
      ],
      extraPropertiesLens: ['estimate'],
    })

    const unrelatedChanged = manager.handleFileChanged('notes/unrelated.md', { 'routine-status': 'done' })
    expect(unrelatedChanged).toBe(false)

    const changed = manager.handleFileChanged('tasks/a.md', {
      'routine-status': 'done',
      'routine-priority': 10,
      'routine-time-spent': 'PT15M',
      'estimate': '20m',
    })
    expect(changed).toBe(true)

    const queue = registry.resolve(focusId)?.getQueue() ?? []
    // Priority 10 sorts after priority 2.
    expect(queue.map(i => i.sourcePath)).toEqual(['tasks/b.md', 'tasks/a.md'])
    const updatedA = queue[1]
    expect(updatedA?.cycleStatus).toBe('done')
    expect(updatedA?.timeSpent.toString()).toBe('PT15M')
    expect(updatedA?.extraProperties).toEqual({ estimate: '20m' })
  })

  test('handleFileDeleted removes matching entry and ignores unrelated files', () => {
    const registry = createTaskSourceRegistry()
    const manager = new FallbackTaskSourceManager(registry)

    manager.retainIfUnprovided(focusId, {
      entries: [
        { path: 'tasks/a.md', basename: 'a', frontmatter: undefined },
        { path: 'tasks/b.md', basename: 'b', frontmatter: undefined },
      ],
    })

    expect(manager.handleFileDeleted('tasks/missing.md')).toBe(false)
    expect(manager.handleFileDeleted('tasks/a.md')).toBe(true)

    const queue = registry.resolve(focusId)?.getQueue() ?? []
    expect(queue.map(i => i.sourcePath)).toEqual(['tasks/b.md'])
  })

  test('handleFileRenamed updates path and basename and ignores unrelated files', () => {
    const registry = createTaskSourceRegistry()
    const manager = new FallbackTaskSourceManager(registry)

    manager.retainIfUnprovided(focusId, {
      entries: [
        { path: 'tasks/a.md', basename: 'a', frontmatter: { 'routine-status': 'active' } },
      ],
    })

    expect(manager.handleFileRenamed('tasks/missing.md', 'tasks/new.md', 'new')).toBe(false)
    expect(manager.handleFileRenamed('tasks/a.md', 'tasks/renamed.md', 'renamed')).toBe(true)

    const queue = registry.resolve(focusId)?.getQueue() ?? []
    expect(queue).toHaveLength(1)
    expect(queue[0]?.sourcePath).toBe('tasks/renamed.md')
    expect(queue[0]?.displayName).toBe('renamed')
    expect(queue[0]?.cycleStatus).toBe('active')
  })
})
