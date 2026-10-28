import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import { PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'
import { PhaseIdSchema, PhaseNodeSchema, type PhaseId } from '../src/domain/phase/phase'
import type { EngineState } from '../src/domain/session/engine-state'
import { deriveStageProgress } from '../src/domain/phase/stage-progress'

function makeTestGraph(phaseIds: readonly string[]): PhaseGraph {
  return {
    id: PhaseGraphIdSchema.parse('test-graph'),
    name: 'Test routine graph',
    phases: phaseIds.map((id, index) => PhaseNodeSchema.parse({
      id,
      name: `Phase ${index + 1}`,
      label: `Stage ${index + 1}: ${id}`,
      duration: Temporal.Duration.from({ minutes: 10 }),
    })),
    transitions: phaseIds.slice(0, -1).map((id, index) => ({
      from: PhaseIdSchema.parse(id),
      to: PhaseIdSchema.parse(phaseIds[index + 1]!),
      guard: { kind: 'always' as const },
      fromPhaseId: PhaseIdSchema.parse(id),
      toPhaseId: PhaseIdSchema.parse(phaseIds[index + 1]!),
      condition: { kind: 'always' as const },
    })),
  }
}

function makeEngineState(
  currentPhaseId: string,
  visitCounts: Readonly<Record<string, number>>,
): EngineState {
  const phaseVisitCounts = Object.entries(visitCounts).reduce<Record<PhaseId, number>>(
    (acc, [key, count]) => ({
      ...acc,
      [PhaseIdSchema.parse(key)]: count,
    }),
    {},
  )

  return {
    status: 'running',
    phaseGraphId: PhaseGraphIdSchema.parse('test-graph'),
    currentPhaseId: PhaseIdSchema.parse(currentPhaseId),
    remaining: Temporal.Duration.from({ minutes: 5 }),
    activeFilePath: null,
    phaseVisitCounts,
    queueExhausted: false,
    session: null,
  }
}

describe('deriveStageProgress', () => {
  test('derives stage progress at initial phase with zero completed stages', () => {
    const graph = makeTestGraph(['inbox', 'actions', 'waiting'])
    const state = makeEngineState('inbox', { inbox: 1 })

    const progress = deriveStageProgress(graph, state)

    expect(progress.totalCount).toBe(3)
    expect(progress.completedCount).toBe(0)
    expect(progress.progressFraction).toBe(0)
    expect(progress.stages).toEqual([
      {
        phaseId: PhaseIdSchema.parse('inbox'),
        label: 'Stage 1: inbox',
        status: 'active',
        isCurrent: true,
      },
      {
        phaseId: PhaseIdSchema.parse('actions'),
        label: 'Stage 2: actions',
        status: 'upcoming',
        isCurrent: false,
      },
      {
        phaseId: PhaseIdSchema.parse('waiting'),
        label: 'Stage 3: waiting',
        status: 'upcoming',
        isCurrent: false,
      },
    ])
  })

  test('derives completed, active, and upcoming stages during intermediate phase execution', () => {
    const graph = makeTestGraph(['inbox', 'actions', 'waiting'])
    const state = makeEngineState('actions', { inbox: 1, actions: 1 })

    const progress = deriveStageProgress(graph, state)

    expect(progress.totalCount).toBe(3)
    expect(progress.completedCount).toBe(1)
    expect(progress.progressFraction).toBeCloseTo(1 / 3, 5)
    expect(progress.stages[0]?.status).toBe('completed')
    expect(progress.stages[0]?.isCurrent).toBe(false)
    expect(progress.stages[1]?.status).toBe('active')
    expect(progress.stages[1]?.isCurrent).toBe(true)
    expect(progress.stages[2]?.status).toBe('upcoming')
    expect(progress.stages[2]?.isCurrent).toBe(false)
  })

  test('derives completed stages at final phase', () => {
    const graph = makeTestGraph(['inbox', 'actions', 'waiting'])
    const state = makeEngineState('waiting', { inbox: 1, actions: 1, waiting: 1 })

    const progress = deriveStageProgress(graph, state)

    expect(progress.totalCount).toBe(3)
    expect(progress.completedCount).toBe(2)
    expect(progress.progressFraction).toBeCloseTo(2 / 3, 5)
    expect(progress.stages[0]?.status).toBe('completed')
    expect(progress.stages[1]?.status).toBe('completed')
    expect(progress.stages[2]?.status).toBe('active')
    expect(progress.stages[2]?.isCurrent).toBe(true)
  })

  test('derives single-phase routine correctly', () => {
    const graph = makeTestGraph(['single-step'])
    const state = makeEngineState('single-step', { 'single-step': 1 })

    const progress = deriveStageProgress(graph, state)

    expect(progress.totalCount).toBe(1)
    expect(progress.completedCount).toBe(0)
    expect(progress.progressFraction).toBe(0)
    expect(progress.stages).toEqual([
      {
        phaseId: PhaseIdSchema.parse('single-step'),
        label: 'Stage 1: single-step',
        status: 'active',
        isCurrent: true,
      },
    ])
  })

  test('revisited active stage in cyclical routine is active while other visited stages are completed', () => {
    const graph = makeTestGraph(['phase-a', 'phase-b'])
    const state = makeEngineState('phase-a', { 'phase-a': 2, 'phase-b': 1 })

    const progress = deriveStageProgress(graph, state)

    expect(progress.totalCount).toBe(2)
    expect(progress.completedCount).toBe(1)
    expect(progress.progressFraction).toBe(0.5)
    expect(progress.stages[0]?.status).toBe('active')
    expect(progress.stages[0]?.isCurrent).toBe(true)
    expect(progress.stages[1]?.status).toBe('completed')
    expect(progress.stages[1]?.isCurrent).toBe(false)
  })

  test('handles empty phases list gracefully', () => {
    const graph: PhaseGraph = {
      id: PhaseGraphIdSchema.parse('empty-graph'),
      name: 'Empty graph',
      phases: [],
      transitions: [],
    }
    const state = makeEngineState('none', {})

    const progress = deriveStageProgress(graph, state)

    expect(progress.totalCount).toBe(0)
    expect(progress.completedCount).toBe(0)
    expect(progress.progressFraction).toBe(0)
    expect(progress.stages).toEqual([])
  })
})
