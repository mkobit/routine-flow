import { describe, expect, test } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { PhaseSchema } from '../src/domain/phase/phase'
import { PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'
import { TaskQueueItemIdSchema } from '../src/domain/queue/task-source'
import { closePhaseInstance, openPhaseInstance, openSession } from '../src/domain/session/session'
import type { ItemTouch } from '../src/domain/session/session'

const minimalPhase = PhaseSchema.parse({
  id: 'focus',
  name: 'Focus',
  label: 'Focus',
  kind: 'focus',
  duration: Temporal.Duration.from({ minutes: 25 }),
  onCompletion: 'autoAdvance',
  taskSourceId: null,
  logTarget: { kind: 'activeItem' },
  handlers: {
    onEnter: [],
    onComplete: [],
    onSkip: [],
    onExit: [],
  },
})

describe('session domain model', () => {
  test('openPhaseInstance creates initial instance with empty itemsTouched', () => {
    const now = Temporal.Instant.from('2026-10-23T12:00:00Z')
    const instance = openPhaseInstance(minimalPhase, now)

    expect(instance.phaseId).toBe(minimalPhase.id)
    expect(instance.phaseDisplayName).toBe(minimalPhase.label)
    expect(instance.phaseKind).toBe(minimalPhase.kind)
    expect(instance.startedAt).toEqual(now)
    expect(instance.endedAt).toBeNull()
    expect(instance.endReason).toBeNull()
    expect(instance.itemsTouched).toEqual([])
  })

  test('closePhaseInstance records endedAt, endReason, and actualDuration', () => {
    const start = Temporal.Instant.from('2026-10-23T12:00:00Z')
    const end = Temporal.Instant.from('2026-10-23T12:25:00Z')
    const instance = openPhaseInstance(minimalPhase, start)
    const closed = closePhaseInstance(instance, end, 'completed')

    expect(closed.endedAt).toEqual(end)
    expect(closed.endReason).toBe('completed')
    expect(closed.actualDuration.total({ unit: 'minute' })).toBe(25)
  })

  test('openSession creates session with active phase instance', () => {
    const now = Temporal.Instant.from('2026-10-23T12:00:00Z')
    const graphId = PhaseGraphIdSchema.parse('graph-1')
    const session = openSession(graphId, now, minimalPhase)

    expect(session.phaseGraphId).toBe(graphId)
    expect(session.startedAt).toEqual(now)
    expect(session.endedAt).toBeNull()
    expect(session.currentInstance?.phaseId).toBe(minimalPhase.id)
    expect(session.history).toEqual([])
  })

  test('ItemTouch captures viewed and completed status with optional completedAt timestamp', () => {
    const viewedTouch: ItemTouch = {
      id: TaskQueueItemIdSchema.parse('task-1'),
      sourcePath: 'tasks/task-1.md',
      displayName: 'Task 1',
      status: 'viewed',
      completedAt: null,
    }
    expect(viewedTouch.status).toBe('viewed')
    expect(viewedTouch.completedAt).toBeNull()

    const completedTime = Temporal.Instant.from('2026-10-23T12:05:00Z')
    const completedTouch: ItemTouch = {
      ...viewedTouch,
      status: 'completed',
      completedAt: completedTime,
    }
    expect(completedTouch.status).toBe('completed')
    expect(completedTouch.completedAt).toEqual(completedTime)
  })
})
