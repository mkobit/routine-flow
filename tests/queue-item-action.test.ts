import { describe, expect, test } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { deriveActionMutations } from '../src/domain/action/derive-action-mutations'
import { QueueItemActionSchema } from '../src/domain/action/queue-item-action'
import { TaskQueueItemIdSchema } from '../src/domain/queue/task-source'

const now = Temporal.Instant.from('2026-08-11T12:00:00Z')

describe('QueueItemActionSchema', () => {
  test('validates queueCycle action with style', () => {
    const action = QueueItemActionSchema.parse({
      id: 'cycle',
      label: 'Cycle to back',
      style: 'default',
      payload: { kind: 'queueCycle' },
    })
    expect(action.id).toBe('cycle')
    expect(action.label).toBe('Cycle to back')
    expect(action.style).toBe('default')
    expect(action.payload).toEqual({ kind: 'queueCycle' })
  })

  test('validates markDone action without optional style', () => {
    const action = QueueItemActionSchema.parse({
      id: 'done',
      label: 'Done',
      payload: { kind: 'markDone' },
    })
    expect(action.id).toBe('done')
    expect(action.style).toBeUndefined()
    expect(action.payload).toEqual({ kind: 'markDone' })
  })

  test('validates deferDuration action with positive duration', () => {
    const action = QueueItemActionSchema.parse({
      id: 'defer-1d',
      label: 'Defer 1 day',
      style: 'primary',
      payload: { kind: 'deferDuration', after: Temporal.Duration.from({ days: 1 }) },
    })
    expect(action.id).toBe('defer-1d')
    expect(action.style).toBe('primary')
    expect(action.payload.kind).toBe('deferDuration')
  })

  test('validates setFrontmatter action with string/number/boolean values', () => {
    const stringAction = QueueItemActionSchema.parse({
      id: 'set-status',
      label: 'Set Status',
      payload: { kind: 'setFrontmatter', property: 'status', value: 'in-review' },
    })
    expect(stringAction.payload).toEqual({ kind: 'setFrontmatter', property: 'status', value: 'in-review' })

    const numberAction = QueueItemActionSchema.parse({
      id: 'set-priority',
      label: 'Set Priority',
      payload: { kind: 'setFrontmatter', property: 'priority', value: 1 },
    })
    expect(numberAction.payload).toEqual({ kind: 'setFrontmatter', property: 'priority', value: 1 })

    const booleanAction = QueueItemActionSchema.parse({
      id: 'set-flag',
      label: 'Set Flag',
      payload: { kind: 'setFrontmatter', property: 'urgent', value: true },
    })
    expect(booleanAction.payload).toEqual({ kind: 'setFrontmatter', property: 'urgent', value: true })
  })

  test('fails validation on empty id or label', () => {
    expect(() =>
      QueueItemActionSchema.parse({
        id: '',
        label: 'Test',
        payload: { kind: 'markDone' },
      }),
    ).toThrow()

    expect(() =>
      QueueItemActionSchema.parse({
        id: 'test',
        label: '',
        payload: { kind: 'markDone' },
      }),
    ).toThrow()
  })

  test('fails validation on invalid style', () => {
    expect(() =>
      QueueItemActionSchema.parse({
        id: 'test',
        label: 'Test',
        style: 'invalid-style',
        payload: { kind: 'markDone' },
      }),
    ).toThrow()
  })

  test('fails validation on zero or negative deferDuration', () => {
    expect(() =>
      QueueItemActionSchema.parse({
        id: 'test',
        label: 'Test',
        payload: { kind: 'deferDuration', after: Temporal.Duration.from({ seconds: 0 }) },
      }),
    ).toThrow()
  })

  test('fails validation on empty setFrontmatter property', () => {
    expect(() =>
      QueueItemActionSchema.parse({
        id: 'test',
        label: 'Test',
        payload: { kind: 'setFrontmatter', property: '', value: 'val' },
      }),
    ).toThrow()
  })
})

describe('deriveActionMutations', () => {
  test('returns empty array when activeFilePath is null', () => {
    const action = QueueItemActionSchema.parse({
      id: 'done',
      label: 'Done',
      payload: { kind: 'markDone' },
    })
    const mutations = deriveActionMutations(action, null, now)
    expect(mutations).toEqual([])
  })

  test('derives queueReorder for queueCycle action', () => {
    const action = QueueItemActionSchema.parse({
      id: 'cycle',
      label: 'Cycle',
      payload: { kind: 'queueCycle' },
    })
    const mutations = deriveActionMutations(action, 'tasks/item-1.md', now)
    expect(mutations).toEqual([
      { kind: 'queueReorder', itemId: TaskQueueItemIdSchema.parse('tasks/item-1.md'), position: 'back' },
    ])
  })

  test('derives queueStatusChange for markDone action', () => {
    const action = QueueItemActionSchema.parse({
      id: 'done',
      label: 'Done',
      payload: { kind: 'markDone' },
    })
    const mutations = deriveActionMutations(action, 'tasks/item-1.md', now)
    expect(mutations).toEqual([
      { kind: 'queueStatusChange', itemId: TaskQueueItemIdSchema.parse('tasks/item-1.md'), status: 'done' },
    ])
  })

  test('derives queueStatusChange deferred and routine-due frontmatter for deferDuration action', () => {
    const action = QueueItemActionSchema.parse({
      id: 'defer',
      label: 'Defer',
      payload: { kind: 'deferDuration', after: Temporal.Duration.from({ days: 1 }) },
    })
    const mutations = deriveActionMutations(action, 'tasks/item-1.md', now)
    expect(mutations).toEqual([
      { kind: 'queueStatusChange', itemId: TaskQueueItemIdSchema.parse('tasks/item-1.md'), status: 'deferred' },
      {
        kind: 'frontmatter',
        filePath: 'tasks/item-1.md',
        property: 'routine-due',
        value: '2026-08-12T12:00:00Z',
      },
    ])
  })

  test('derives frontmatter mutation for setFrontmatter action', () => {
    const action = QueueItemActionSchema.parse({
      id: 'priority',
      label: 'Priority 1',
      payload: { kind: 'setFrontmatter', property: 'priority', value: 1 },
    })
    const mutations = deriveActionMutations(action, 'tasks/item-1.md', now)
    expect(mutations).toEqual([
      {
        kind: 'frontmatter',
        filePath: 'tasks/item-1.md',
        property: 'priority',
        value: 1,
      },
    ])
  })
})
