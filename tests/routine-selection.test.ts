import { test, expect, describe } from 'bun:test'
import { decideStartAction, resolveRoutineGraph } from '../src/timer/routine-selection'
import { PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'

const defaultId = PhaseGraphIdSchema.parse('default')
const standupId = PhaseGraphIdSchema.parse('standup')

const focusRoutine = {
  id: 'focus-routine',
  name: 'Focus routine',
  phases: [
    {
      id: 'focus',
      label: 'Focus',
      kind: 'focus',
      duration: 'PT10M',
      taskSourceId: null,
      completionPolicy: null,
      notification: null,
      logTarget: { kind: 'activeItem' },
      onEnter: null,
      onComplete: null,
      onSkip: null,
      onExit: null,
    },
  ],
  // Self-loop: a real single-phase routine still needs a way out, or checkPhaseGraphIntegrity's
  // "reachable phase with no outgoing transitions" check (flow-gu1.31) rejects it.
  transitions: [{ fromPhaseId: 'focus', toPhaseId: 'focus', condition: { kind: 'always' } }],
}

function routineFile(graph: unknown): string {
  return `\`\`\`json\n${JSON.stringify(graph)}\n\`\`\`\n`
}

describe('resolveRoutineGraph', () => {
  test('a valid routine file resolves to a loaded PhaseGraph', () => {
    const resolution = resolveRoutineGraph(routineFile(focusRoutine))

    expect(resolution.kind).toBe('loaded')
    expect(resolution.kind === 'loaded' && resolution.graph.id).toBe(PhaseGraphIdSchema.parse('focus-routine'))
  })

  test('an unparseable routine file resolves to an error carrying the parse failure message', () => {
    const resolution = resolveRoutineGraph('no fenced block here')

    expect(resolution.kind).toBe('error')
    expect(resolution.kind === 'error' && resolution.error.message).toContain('no fenced JSON code block')
  })
})

describe('decideStartAction', () => {
  test('starts immediately when no session is in progress (stopped)', () => {
    const action = decideStartAction({ graphId: defaultId, status: 'stopped' }, defaultId)
    expect(action).toBe('start')
  })

  test('starts immediately when the running session already matches the requested routine', () => {
    const action = decideStartAction({ graphId: defaultId, status: 'running' }, defaultId)
    expect(action).toBe('start')
  })

  test('confirms when a different routine is running', () => {
    const action = decideStartAction({ graphId: defaultId, status: 'running' }, standupId)
    expect(action).toBe('confirm')
  })

  test('confirms when a different routine is paused (still in progress)', () => {
    const action = decideStartAction({ graphId: defaultId, status: 'paused' }, standupId)
    expect(action).toBe('confirm')
  })

  test('confirms when a different routine is completed (still in progress)', () => {
    const action = decideStartAction({ graphId: defaultId, status: 'completed' }, standupId)
    expect(action).toBe('confirm')
  })

  test('starts immediately when a different routine is only stopped (no progress to lose)', () => {
    const action = decideStartAction({ graphId: defaultId, status: 'stopped' }, standupId)
    expect(action).toBe('start')
  })
})
