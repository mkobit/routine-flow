import { describe, expect, test } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { PhaseSchema } from '../src/domain/phase/phase'
import { TaskQueueItemIdSchema } from '../src/domain/queue/task-source'
import { deriveCompletionMutations } from '../src/timer/completion-policy-executor'

const now = Temporal.Instant.from('2026-08-11T12:00:00Z')

const basePhase = {
  id: 'focus',
  label: 'Focus',
  kind: 'focus',
  duration: Temporal.Duration.from({ seconds: 1500 }),
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  onEnter: null,
  onComplete: null,
  onSkip: null,
  onExit: null,
  logTarget: { kind: 'activeItem' },
}

describe('deriveCompletionMutations', () => {
  test('returns empty array when completionPolicy is null', () => {
    const phase = PhaseSchema.parse(basePhase)
    const mutations = deriveCompletionMutations(phase, 'notes/task-1.md', now)
    expect(mutations).toEqual([])
  })

  test('returns empty array when activeFilePath is null', () => {
    const phase = PhaseSchema.parse({
      ...basePhase,
      completionPolicy: { kind: 'queueCycle' },
    })
    const mutations = deriveCompletionMutations(phase, null, now)
    expect(mutations).toEqual([])
  })

  test('derives queueReorder to back for queueCycle policy', () => {
    const phase = PhaseSchema.parse({
      ...basePhase,
      completionPolicy: { kind: 'queueCycle' },
    })
    const mutations = deriveCompletionMutations(phase, 'notes/task-1.md', now)
    expect(mutations).toEqual([
      { kind: 'queueReorder', itemId: TaskQueueItemIdSchema.parse('notes/task-1.md'), position: 'back' },
    ])
  })

  test('derives queueStatusChange and routine-due frontmatter for futureDate policy', () => {
    const phase = PhaseSchema.parse({
      ...basePhase,
      completionPolicy: { kind: 'futureDate', after: Temporal.Duration.from({ days: 3 }) },
    })
    const mutations = deriveCompletionMutations(phase, 'notes/card-1.md', now)
    expect(mutations).toEqual([
      { kind: 'queueStatusChange', itemId: TaskQueueItemIdSchema.parse('notes/card-1.md'), status: 'deferred' },
      {
        kind: 'frontmatter',
        filePath: 'notes/card-1.md',
        property: 'routine-due',
        value: '2026-08-14T12:00:00Z',
      },
    ])
  })
})
