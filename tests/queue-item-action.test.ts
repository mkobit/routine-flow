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

  test('validates deferDuration action with optional property, box tier, and setProperties', () => {
    const action = QueueItemActionSchema.parse({
      id: 'leitner-good',
      label: 'Good (3d)',
      payload: {
        kind: 'deferDuration',
        after: Temporal.Duration.from({ days: 3 }),
        property: 'next-review',
        box: 3,
        boxProperty: 'leitner-box',
        setProperties: { reviewedCount: 5 },
      },
    })
    expect(action.payload).toEqual({
      kind: 'deferDuration',
      after: Temporal.Duration.from({ days: 3 }),
      property: 'next-review',
      box: 3,
      boxProperty: 'leitner-box',
      setProperties: { reviewedCount: 5 },
    })
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

  test('fails validation on empty deferDuration property or boxProperty', () => {
    expect(() =>
      QueueItemActionSchema.parse({
        id: 'test',
        label: 'Test',
        payload: {
          kind: 'deferDuration',
          after: Temporal.Duration.from({ days: 1 }),
          property: '',
        },
      }),
    ).toThrow()

    expect(() =>
      QueueItemActionSchema.parse({
        id: 'test',
        label: 'Test',
        payload: {
          kind: 'deferDuration',
          after: Temporal.Duration.from({ days: 1 }),
          boxProperty: '',
        },
      }),
    ).toThrow()
  })

  test('fails validation on negative or non-integer box on deferDuration', () => {
    expect(() =>
      QueueItemActionSchema.parse({
        id: 'test',
        label: 'Test',
        payload: {
          kind: 'deferDuration',
          after: Temporal.Duration.from({ days: 1 }),
          box: -1,
        },
      }),
    ).toThrow()

    expect(() =>
      QueueItemActionSchema.parse({
        id: 'test',
        label: 'Test',
        payload: {
          kind: 'deferDuration',
          after: Temporal.Duration.from({ days: 1 }),
          box: 2.5,
        },
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

  test('derives configurable review date property when property is specified on deferDuration', () => {
    const action = QueueItemActionSchema.parse({
      id: 'custom-defer',
      label: 'Defer until tomorrow',
      payload: {
        kind: 'deferDuration',
        after: Temporal.Duration.from({ days: 1 }),
        property: 'next-review',
      },
    })
    const mutations = deriveActionMutations(action, 'cards/card-1.md', now)
    expect(mutations).toEqual([
      { kind: 'queueStatusChange', itemId: TaskQueueItemIdSchema.parse('cards/card-1.md'), status: 'deferred' },
      {
        kind: 'frontmatter',
        filePath: 'cards/card-1.md',
        property: 'next-review',
        value: '2026-08-12T12:00:00Z',
      },
    ])
  })

  test('derives mutations for standard Leitner review grades (Again, Hard, Good, Easy)', () => {
    const againAction = QueueItemActionSchema.parse({
      id: 'grade-again',
      label: 'Again (10m)',
      payload: {
        kind: 'deferDuration',
        after: Temporal.Duration.from({ minutes: 10 }),
        property: 'routine-due',
        box: 1,
      },
    })
    expect(deriveActionMutations(againAction, 'cards/vocab.md', now)).toEqual([
      { kind: 'queueStatusChange', itemId: TaskQueueItemIdSchema.parse('cards/vocab.md'), status: 'deferred' },
      {
        kind: 'frontmatter',
        filePath: 'cards/vocab.md',
        property: 'routine-due',
        value: '2026-08-11T12:10:00Z',
      },
      {
        kind: 'frontmatter',
        filePath: 'cards/vocab.md',
        property: 'box',
        value: 1,
      },
    ])

    const hardAction = QueueItemActionSchema.parse({
      id: 'grade-hard',
      label: 'Hard (1d)',
      payload: {
        kind: 'deferDuration',
        after: Temporal.Duration.from({ days: 1 }),
        property: 'routine-due',
        box: 2,
      },
    })
    expect(deriveActionMutations(hardAction, 'cards/vocab.md', now)).toEqual([
      { kind: 'queueStatusChange', itemId: TaskQueueItemIdSchema.parse('cards/vocab.md'), status: 'deferred' },
      {
        kind: 'frontmatter',
        filePath: 'cards/vocab.md',
        property: 'routine-due',
        value: '2026-08-12T12:00:00Z',
      },
      {
        kind: 'frontmatter',
        filePath: 'cards/vocab.md',
        property: 'box',
        value: 2,
      },
    ])

    const goodAction = QueueItemActionSchema.parse({
      id: 'grade-good',
      label: 'Good (3d)',
      payload: {
        kind: 'deferDuration',
        after: Temporal.Duration.from({ days: 3 }),
        property: 'routine-due',
        box: 3,
      },
    })
    expect(deriveActionMutations(goodAction, 'cards/vocab.md', now)).toEqual([
      { kind: 'queueStatusChange', itemId: TaskQueueItemIdSchema.parse('cards/vocab.md'), status: 'deferred' },
      {
        kind: 'frontmatter',
        filePath: 'cards/vocab.md',
        property: 'routine-due',
        value: '2026-08-14T12:00:00Z',
      },
      {
        kind: 'frontmatter',
        filePath: 'cards/vocab.md',
        property: 'box',
        value: 3,
      },
    ])

    const easyAction = QueueItemActionSchema.parse({
      id: 'grade-easy',
      label: 'Easy (7d)',
      payload: {
        kind: 'deferDuration',
        after: Temporal.Duration.from({ days: 7 }),
        property: 'routine-due',
        box: 4,
      },
    })
    expect(deriveActionMutations(easyAction, 'cards/vocab.md', now)).toEqual([
      { kind: 'queueStatusChange', itemId: TaskQueueItemIdSchema.parse('cards/vocab.md'), status: 'deferred' },
      {
        kind: 'frontmatter',
        filePath: 'cards/vocab.md',
        property: 'routine-due',
        value: '2026-08-18T12:00:00Z',
      },
      {
        kind: 'frontmatter',
        filePath: 'cards/vocab.md',
        property: 'box',
        value: 4,
      },
    ])
  })

  test('derives mutations with custom boxProperty and setProperties alongside deferDuration', () => {
    const action = QueueItemActionSchema.parse({
      id: 'custom-leitner',
      label: 'Promote',
      payload: {
        kind: 'deferDuration',
        after: Temporal.Duration.from({ days: 5 }),
        property: 'routine-deferred-until',
        box: 5,
        boxProperty: 'leitner-tier',
        setProperties: {
          lastGrade: 'easy',
          repetitions: 12,
        },
      },
    })
    const mutations = deriveActionMutations(action, 'cards/math.md', now)
    expect(mutations).toEqual([
      { kind: 'queueStatusChange', itemId: TaskQueueItemIdSchema.parse('cards/math.md'), status: 'deferred' },
      {
        kind: 'frontmatter',
        filePath: 'cards/math.md',
        property: 'routine-deferred-until',
        value: '2026-08-16T12:00:00Z',
      },
      {
        kind: 'frontmatter',
        filePath: 'cards/math.md',
        property: 'leitner-tier',
        value: 5,
      },
      {
        kind: 'frontmatter',
        filePath: 'cards/math.md',
        property: 'lastGrade',
        value: 'easy',
      },
      {
        kind: 'frontmatter',
        filePath: 'cards/math.md',
        property: 'repetitions',
        value: 12,
      },
    ])
  })
})
