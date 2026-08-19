import { describe, expect, test } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { PhaseIdSchema, PhaseKindSchema, PhaseNodeSchema } from '../src/domain/phase/phase'
import { PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'
import { TaskQueueItemIdSchema } from '../src/domain/queue/task-source'
import { PhaseInstanceIdSchema, SessionIdSchema } from '../src/domain/session/session'
import type { PhaseInstance, Session } from '../src/domain/session/session'
import { executeHandler } from '../src/timer/handler-executor'
import type { HandlerContext } from '../src/timer/handler-executor'

const now = Temporal.Instant.from('2026-08-11T12:00:00Z')

const basePhase = PhaseNodeSchema.parse({
  id: 'focus',
  name: 'Focus',
  label: 'Focus',
  kind: 'focus',
  duration: Temporal.Duration.from({ seconds: 1500 }),
  onCompletion: 'autoAdvance',
  taskSourceId: null,
  logTarget: { kind: 'activeItem' },
})

const sampleInstance: PhaseInstance = {
  id: PhaseInstanceIdSchema.parse('inst-1'),
  phaseId: PhaseIdSchema.parse('focus'),
  phaseDisplayName: 'Focus',
  phaseKind: PhaseKindSchema.parse('focus'),
  plannedDuration: basePhase.duration,
  actualDuration: Temporal.Duration.from({ seconds: 0 }),
  startedAt: now,
  endedAt: null,
  endReason: null,
  itemsTouched: [],
  mutationsApplied: [],
  hookFailures: [],
}

const sampleSession: Session = {
  id: SessionIdSchema.parse('sess-1'),
  phaseGraphId: PhaseGraphIdSchema.parse('default'),
  startedAt: now,
  endedAt: null,
  history: [],
  currentInstance: sampleInstance,
}

const baseContext: HandlerContext = {
  phase: basePhase,
  instance: sampleInstance,
  session: sampleSession,
  activeFilePath: 'notes/task-1.md',
  now,
}

describe('executeHandler', () => {
  test('returns empty array when preset handler target file is null', async () => {
    const effects = await executeHandler(
      { kind: 'preset', preset: 'queueCycle' },
      { ...baseContext, activeFilePath: null },
    )
    expect(effects).toEqual([])
  })

  test('derives queueCycle preset effect', async () => {
    const effects = await executeHandler(
      { kind: 'preset', preset: 'queueCycle' },
      baseContext,
    )
    expect(effects).toEqual([{
      kind: 'fileMutation',
      mutations: [{ kind: 'queueReorder', itemId: TaskQueueItemIdSchema.parse('notes/task-1.md'), position: 'back' }],
    }])
  })

  test('derives markDone preset effect', async () => {
    const effects = await executeHandler(
      { kind: 'preset', preset: 'markDone' },
      baseContext,
    )
    expect(effects).toEqual([{
      kind: 'fileMutation',
      mutations: [{ kind: 'queueStatusChange', itemId: TaskQueueItemIdSchema.parse('notes/task-1.md'), status: 'done' }],
    }])
  })

  test('derives setFrontmatter preset effect', async () => {
    const effects = await executeHandler(
      { kind: 'preset', preset: 'setFrontmatter', params: { property: 'completed-at', value: '2026-08-11' } },
      baseContext,
    )
    expect(effects).toEqual([{
      kind: 'fileMutation',
      mutations: [{ kind: 'frontmatter', filePath: 'notes/task-1.md', property: 'completed-at', value: '2026-08-11' }],
    }])
  })

  test('derives notify preset effect', async () => {
    const effects = await executeHandler(
      { kind: 'preset', preset: 'notify', params: { title: 'Custom Title', body: 'Custom Body' } },
      baseContext,
    )
    expect(effects).toEqual([{
      kind: 'notification',
      notification: { title: 'Custom Title', body: 'Custom Body', system: false },
    }])
  })
})
