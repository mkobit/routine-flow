import { mock, test, expect, describe } from 'bun:test'

void mock.module('obsidian', () => {
  return {
    PluginSettingTab: class {},
    Setting: class {},
    App: class {},
    Plugin: class {},
    TFile: class {},
  }
})

import { Temporal } from 'temporal-polyfill'
import { deriveHookEvents, engineReducer, initialEngineState } from '../src/timer/reducer'
import type { StampedEngineAction } from '../src/timer/reducer'
import type { EngineState } from '../src/domain/session/engine-state'
import { PhaseGraphSchema, PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import { PhaseSchema, PhaseIdSchema, type PhaseNode } from '../src/domain/phase/phase'
import type { PhaseId } from '../src/domain/phase/phase'
import { PredicateNameSchema } from '../src/domain/hook/predicate'
import type { PredicateRegistry } from '../src/domain/hook/predicate'

const focusId = PhaseIdSchema.parse('focus')
const breakId = PhaseIdSchema.parse('break')
const longBreakId = PhaseIdSchema.parse('long-break')
const testGraphId = PhaseGraphIdSchema.parse('test')

const now = Temporal.Now.instant()

const phaseDefaults = {
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  onEnter: null,
  onComplete: null,
  onSkip: null,
  onExit: null,
} as const

const testGraph: PhaseGraph = PhaseGraphSchema.parse({
  id: 'test',
  name: 'Test graph',
  phases: [
    PhaseSchema.parse({ ...phaseDefaults, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 1500 }), logTarget: { kind: 'activeItem' } }),
    PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 300 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
    PhaseSchema.parse({ ...phaseDefaults, id: 'long-break', label: 'Long break', kind: 'break', duration: Temporal.Duration.from({ seconds: 900 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
  ],
  transitions: [
    { fromPhaseId: 'focus', toPhaseId: 'long-break', condition: { kind: 'everyNth', n: 4 } },
    { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
    { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
    { fromPhaseId: 'long-break', toPhaseId: 'focus', condition: { kind: 'always' } },
  ],
})

describe('engineReducer', () => {
  test('initialEngineState builds stopped state at the first declared phase', () => {
    const state = initialEngineState(testGraph)
    expect(state.status).toBe('stopped')
    expect(state.phaseGraphId).toBe(testGraphId)
    expect(state.currentPhaseId).toBe(focusId)
    expect(state.remaining?.total({ unit: 'seconds' })).toBe(1500)
    expect(state.activeFilePath).toBeNull()
    expect(state.session).toBeNull()
  })

  test('start transitions to running and records file path', () => {
    const state = initialEngineState(testGraph)
    const next = engineReducer(state, { type: 'start', filePath: 'task.md', now }, testGraph)
    expect(next.status).toBe('running')
    expect(next.activeFilePath).toBe('task.md')
  })

  test('start opens a new session with a freshly opened currentInstance', () => {
    const state = initialEngineState(testGraph)
    const next = engineReducer(state, { type: 'start', now }, testGraph)
    expect(next.session).not.toBeNull()
    expect(next.session?.history).toEqual([])
    expect(next.session?.currentInstance?.phaseId).toBe(focusId)
    expect(next.session?.currentInstance?.endedAt).toBeNull()
  })

  test('start leaves an already-open session\'s identity untouched when re-targeting the active file', () => {
    const state = initialEngineState(testGraph)
    const opened = engineReducer(state, { type: 'start', now }, testGraph)
    const retargeted = engineReducer(opened, { type: 'start', filePath: 'other.md', now }, testGraph)
    expect(retargeted.session?.id).toBe(opened.session?.id)
    expect(retargeted.session?.currentInstance?.id).toBe(opened.session?.currentInstance?.id)
    expect(retargeted.activeFilePath).toBe('other.md')
  })

  test('set-active-file updates activeFilePath without touching status', () => {
    const state: EngineState = { ...initialEngineState(testGraph), status: 'running', activeFilePath: 'task.md' }
    const next = engineReducer(state, { type: 'set-active-file', filePath: 'other.md' }, testGraph)
    expect(next.activeFilePath).toBe('other.md')
    expect(next.status).toBe('running')
  })

  test('set-active-file is a no-op when the file path is unchanged', () => {
    const state: EngineState = { ...initialEngineState(testGraph), activeFilePath: 'task.md' }
    const next = engineReducer(state, { type: 'set-active-file', filePath: 'task.md' }, testGraph)
    expect(next).toBe(state)
  })

  test('set-active-file can clear activeFilePath back to null', () => {
    const state: EngineState = { ...initialEngineState(testGraph), activeFilePath: 'task.md' }
    const next = engineReducer(state, { type: 'set-active-file', filePath: null }, testGraph)
    expect(next.activeFilePath).toBeNull()
  })

  test('set-queue-exhausted updates queueExhausted without touching status', () => {
    const state: EngineState = { ...initialEngineState(testGraph), status: 'running' }
    const next = engineReducer(state, { type: 'set-queue-exhausted', exhausted: true }, testGraph)
    expect(next.queueExhausted).toBe(true)
    expect(next.status).toBe('running')
  })

  test('set-queue-exhausted is a no-op when the value is unchanged', () => {
    const state: EngineState = initialEngineState(testGraph)
    const next = engineReducer(state, { type: 'set-queue-exhausted', exhausted: false }, testGraph)
    expect(next).toBe(state)
  })

  test('pause transitions running to paused', () => {
    const state: EngineState = { ...initialEngineState(testGraph), status: 'running' }
    const next = engineReducer(state, { type: 'pause' }, testGraph)
    expect(next.status).toBe('paused')
  })

  test('resume transitions paused to running', () => {
    const state: EngineState = { ...initialEngineState(testGraph), status: 'paused' }
    const next = engineReducer(state, { type: 'resume' }, testGraph)
    expect(next.status).toBe('running')
  })

  test('stop resets to initial state at the first phase', () => {
    const running: EngineState = {
      status: 'running',
      phaseGraphId: testGraphId,
      currentPhaseId: breakId,
      remaining: Temporal.Duration.from({ seconds: 42 }),
      activeFilePath: 'task.md',
      phaseVisitCounts: { [focusId]: 1 },
      queueExhausted: false,
      session: null,
    }
    const next = engineReducer(running, { type: 'stop', now }, testGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(focusId)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(1500)
    expect(next.activeFilePath).toBeNull()
  })

  test('stop mid-session resets session to null', () => {
    const started = engineReducer(initialEngineState(testGraph), { type: 'start', now }, testGraph)
    const next = engineReducer(started, { type: 'stop', now }, testGraph)
    expect(next.session).toBeNull()
  })

  test('tick decrements remaining time by one second', () => {
    const state: EngineState = {
      ...initialEngineState(testGraph),
      status: 'running',
      remaining: Temporal.Duration.from({ seconds: 10 }),
    }
    const next = engineReducer(state, { type: 'tick', now }, testGraph)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(9)
    expect(next.status).toBe('running')
  })

  test('tick at 0 advances to next phase and stops', () => {
    const state: EngineState = {
      ...initialEngineState(testGraph),
      status: 'running',
      remaining: Temporal.Duration.from({ seconds: 0 }),
    }
    const next = engineReducer(state, { type: 'tick', now }, testGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(breakId)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(300)
  })

  test('natural completion closes the outgoing instance with endReason \'completed\' and opens the next one', () => {
    const started = engineReducer(initialEngineState(testGraph), { type: 'start', now }, testGraph)
    const state: EngineState = { ...started, remaining: Temporal.Duration.from({ seconds: 0 }) }
    const next = engineReducer(state, { type: 'tick', now }, testGraph)
    const closed = next.session?.history.at(-1)
    expect(closed?.endReason).toBe('completed')
    expect(closed?.endedAt).not.toBeNull()
    expect(closed?.phaseId).toBe(focusId)
    expect(next.session?.currentInstance?.phaseId).toBe(breakId)
    expect(next.session?.currentInstance?.endedAt).toBeNull()
  })

  test('tick is a no-op for a duration-less phase', () => {
    const state: EngineState = {
      ...initialEngineState(testGraph),
      status: 'running',
      remaining: null,
    }
    const next = engineReducer(state, { type: 'tick', now }, testGraph)
    expect(next).toBe(state)
  })

  test('advance-phase cycles focus <-> break, taking the long break on the 4th focus exit', () => {
    const action: StampedEngineAction = { type: 'advance-phase', now }
    let state: EngineState = { ...initialEngineState(testGraph), status: 'running' }

    // Exits 1-3 from focus: everyNth(4) not due yet, falls through to 'always' (break)
    const expectedIds: PhaseId[] = [breakId, focusId, breakId, focusId, breakId, focusId]
    for (const expected of expectedIds) {
      state = engineReducer(state, action, testGraph)
      expect(state.currentPhaseId).toBe(expected)
    }

    // 4th exit from focus: everyNth(4) is due, takes the long-break branch instead of 'always'
    state = engineReducer(state, action, testGraph)
    expect(state.currentPhaseId).toBe(longBreakId)
    expect(state.remaining?.total({ unit: 'seconds' })).toBe(900)

    // Exiting long-break falls back to 'always' -> focus
    state = engineReducer(state, action, testGraph)
    expect(state.currentPhaseId).toBe(focusId)
  })

  test('advance-phase closes the outgoing instance with endReason \'skipped\'', () => {
    const started = engineReducer(initialEngineState(testGraph), { type: 'start', now }, testGraph)
    const next = engineReducer(started, { type: 'advance-phase', now }, testGraph)
    const closed = next.session?.history.at(-1)
    expect(closed?.endReason).toBe('skipped')
    expect(closed?.phaseId).toBe(focusId)
  })

  test('an open instance never appears in history', () => {
    const started = engineReducer(initialEngineState(testGraph), { type: 'start', now }, testGraph)
    expect(started.session?.history.some(instance => instance.endedAt === null)).toBe(false)
    expect(started.session?.currentInstance?.endedAt).toBeNull()
  })

  test('reducer output is a deterministic function of its now input', () => {
    const started = engineReducer(initialEngineState(testGraph), { type: 'start', now }, testGraph)
    const laterNow = now.add({ seconds: 5 })

    const closedAtNow = engineReducer(started, { type: 'advance-phase', now }, testGraph)
    const closedAtLater = engineReducer(started, { type: 'advance-phase', now: laterNow }, testGraph)

    expect(closedAtNow.session?.history.at(-1)?.endedAt).toEqual(now)
    expect(closedAtLater.session?.history.at(-1)?.endedAt).toEqual(laterNow)
    expect(closedAtNow.session?.currentInstance?.startedAt).toEqual(now)
    expect(closedAtLater.session?.currentInstance?.startedAt).toEqual(laterNow)
    expect({ ...closedAtNow, session: null }).toEqual({ ...closedAtLater, session: null })
  })

  test('a later phase rename doesn\'t change a previously closed instance\'s recorded name', () => {
    const started = engineReducer(initialEngineState(testGraph), { type: 'start', now }, testGraph)
    const next = engineReducer(started, { type: 'advance-phase', now }, testGraph)
    const closed = next.session?.history.at(-1)
    expect(closed?.phaseDisplayName).toBe('Focus')

    // Reconfigure the graph so 'focus' is now labelled 'Deep Work', then re-enter it.
    const renamedGraph: PhaseGraph = PhaseGraphSchema.parse({
      ...testGraph,
      phases: testGraph.phases.map((phase: PhaseNode) => phase.id === focusId ? { ...phase, label: 'Deep Work' } : phase),
    })
    const backToFocus = engineReducer(next, { type: 'advance-phase', now }, renamedGraph)

    // The already-closed instance's snapshot is untouched by the rename...
    expect(closed?.phaseDisplayName).toBe('Focus')
    // ...while a freshly opened instance against the renamed graph picks up the new label.
    expect(backToFocus.session?.currentInstance?.phaseDisplayName).toBe('Deep Work')
  })

  test('two visits to the same phase produce distinct PhaseInstance ids', () => {
    const started = engineReducer(initialEngineState(testGraph), { type: 'start', now }, testGraph)
    const firstFocusInstanceId = started.session?.currentInstance?.id

    const afterBreak = engineReducer(started, { type: 'advance-phase', now }, testGraph)
    const backToFocus = engineReducer(afterBreak, { type: 'advance-phase', now }, testGraph)

    expect(backToFocus.currentPhaseId).toBe(focusId)
    expect(backToFocus.session?.currentInstance?.id).not.toBe(firstFocusInstanceId)
  })

  test('actualDuration is the wall-clock span from startedAt to close, inclusive of any paused time', () => {
    const started = engineReducer(initialEngineState(testGraph), { type: 'start', now }, testGraph)
    const paused = engineReducer(started, { type: 'pause' }, testGraph)
    const resumed = engineReducer(paused, { type: 'resume' }, testGraph)
    const closedAt = now.add({ seconds: 90 })

    const next = engineReducer(resumed, { type: 'advance-phase', now: closedAt }, testGraph)

    expect(next.session?.history.at(-1)?.actualDuration.total({ unit: 'seconds' })).toBe(90)
  })

  test('deriveHookEvents fires nothing for a transition where no session was ever open', () => {
    const state: EngineState = { ...initialEngineState(testGraph), status: 'running' }
    const next = engineReducer(state, { type: 'advance-phase', now }, testGraph)
    expect(next.currentPhaseId).toBe(breakId)
    expect(next.session).toBeNull()

    // No throw, despite there being no PhaseInstance to attribute a firing to.
    expect(deriveHookEvents(state, next, { type: 'advance-phase' }, testGraph)).toEqual([])
  })

  test('tick at 0 halts at status "completed" for a manualClear phase, without advancing', () => {
    const manualClearGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'manual-clear',
      name: 'Manual clear graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, completionPolicy: { kind: 'manualClear' }, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 5 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    })
    const state: EngineState = {
      ...initialEngineState(manualClearGraph),
      status: 'running',
      remaining: Temporal.Duration.from({ seconds: 0 }),
    }
    const next = engineReducer(state, { type: 'tick', now }, manualClearGraph)
    expect(next.status).toBe('completed')
    expect(next.currentPhaseId).toBe(focusId)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(0)
  })

  test('advance-phase clears a completed manualClear phase, same as from running', () => {
    const manualClearGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'manual-clear',
      name: 'Manual clear graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, completionPolicy: { kind: 'manualClear' }, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 5 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    })
    const state: EngineState = {
      ...initialEngineState(manualClearGraph),
      status: 'completed',
      remaining: Temporal.Duration.from({ seconds: 0 }),
    }
    const next = engineReducer(state, { type: 'advance-phase', now }, manualClearGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(breakId)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(5)
  })

  test('advance-phase clearing an already-completed manualClear phase closes its instance with endReason \'completed\', not \'skipped\'', () => {
    const manualClearGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'manual-clear',
      name: 'Manual clear graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, completionPolicy: { kind: 'manualClear' }, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 5 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    })
    const started = engineReducer(initialEngineState(manualClearGraph), { type: 'start', now }, manualClearGraph)
    const completed = engineReducer(started, { type: 'finish-phase', now }, manualClearGraph)
    expect(completed.status).toBe('completed')

    const cleared = engineReducer(completed, { type: 'advance-phase', now }, manualClearGraph)

    expect(cleared.session?.history.at(-1)?.endReason).toBe('completed')
  })

  test('tick at 0 advances a noOp-policy phase identically to a null-policy phase', () => {
    const noOpGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'test',
      name: 'Test graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, completionPolicy: { kind: 'noOp' }, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 1500 }), logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 300 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    })
    const state: EngineState = {
      ...initialEngineState(noOpGraph),
      status: 'running',
      remaining: Temporal.Duration.from({ seconds: 0 }),
    }
    const next = engineReducer(state, { type: 'tick', now }, noOpGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(breakId)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(300)
  })

  test.each([
    ['queueCycle', { kind: 'queueCycle' } as const],
    ['futureDate', { kind: 'futureDate', after: Temporal.Duration.from({ days: 1 }) } as const],
  ])('tick at 0 auto-advances for %s completion policy', (_name, completionPolicy) => {
    const policyGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'test',
      name: 'Test graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, completionPolicy, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 1500 }), logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 300 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    })
    const state: EngineState = {
      ...initialEngineState(policyGraph),
      status: 'running',
      remaining: Temporal.Duration.from({ seconds: 0 }),
    }
    const next = engineReducer(state, { type: 'tick', now }, policyGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(breakId)
  })

  test('finish-phase halts at status "completed" for a manualClear phase, without advancing', () => {
    const manualClearGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'manual-clear',
      name: 'Manual clear graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, completionPolicy: { kind: 'manualClear' }, id: 'focus', label: 'Focus', kind: 'focus', duration: null, logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 5 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    })
    const state: EngineState = { ...initialEngineState(manualClearGraph), status: 'running' }
    const next = engineReducer(state, { type: 'finish-phase', now }, manualClearGraph)
    expect(next.status).toBe('completed')
    expect(next.currentPhaseId).toBe(focusId)
    expect(next.remaining).toBeNull()
  })

  test('finish-phase advances a null-policy duration-less phase to the next phase', () => {
    const state: EngineState = {
      ...initialEngineState(testGraph),
      status: 'running',
      remaining: null,
    }
    const next = engineReducer(state, { type: 'finish-phase', now }, testGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(breakId)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(300)
  })

  test('finish-phase completes a phase even when remaining is non-null, not gated on duration-less state', () => {
    const state: EngineState = {
      ...initialEngineState(testGraph),
      status: 'running',
      remaining: Temporal.Duration.from({ seconds: 42 }),
    }
    const next = engineReducer(state, { type: 'finish-phase', now }, testGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(breakId)
  })

  test.each([
    ['queueCycle', { kind: 'queueCycle' } as const],
    ['futureDate', { kind: 'futureDate', after: Temporal.Duration.from({ days: 1 }) } as const],
  ])('finish-phase auto-advances for %s completion policy', (_name, completionPolicy) => {
    const policyGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'test',
      name: 'Test graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, completionPolicy, id: 'focus', label: 'Focus', kind: 'focus', duration: null, logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 300 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    })
    const state: EngineState = { ...initialEngineState(policyGraph), status: 'running' }
    const next = engineReducer(state, { type: 'finish-phase', now }, policyGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(breakId)
  })

  test('advance-phase on terminal phase node transitions status to ended', () => {
    const terminalGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'terminal',
      name: 'Terminal graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, id: 'only', label: 'Only', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
      ],
      transitions: [],
    })
    const state: EngineState = { ...initialEngineState(terminalGraph), status: 'running' }
    const next = engineReducer(state, { type: 'advance-phase', now }, terminalGraph)
    expect(next.status).toBe('ended')
  })

  describe('custom TransitionCondition resolution', () => {
    const isRestDayName = PredicateNameSchema.parse('isRestDay')
    const skipToId = PhaseIdSchema.parse('skip-to')
    const normalNextId = PhaseIdSchema.parse('normal-next')

    const customConditionGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'custom-condition',
      name: 'Custom condition graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, id: 'weights', label: 'Weights', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'skip-to', label: 'Skip to', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'normal-next', label: 'Normal next', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
      ],
      transitions: [
        { fromPhaseId: 'weights', toPhaseId: 'skip-to', condition: { kind: 'custom', predicate: isRestDayName } },
        { fromPhaseId: 'weights', toPhaseId: 'normal-next', condition: { kind: 'always' } },
      ],
    })

    function registryResolvingTo(result: boolean): PredicateRegistry {
      return { resolve: name => (name === isRestDayName ? () => result : undefined) }
    }

    test('a resolvable predicate returning true satisfies the transition', () => {
      const state: EngineState = { ...initialEngineState(customConditionGraph), status: 'running' }
      const next = engineReducer(state, { type: 'advance-phase', now }, customConditionGraph, { predicateRegistry: registryResolvingTo(true) })
      expect(next.currentPhaseId).toBe(skipToId)
    })

    test('a resolvable predicate returning false falls through to the next candidate', () => {
      const state: EngineState = { ...initialEngineState(customConditionGraph), status: 'running' }
      const next = engineReducer(state, { type: 'advance-phase', now }, customConditionGraph, { predicateRegistry: registryResolvingTo(false) })
      expect(next.currentPhaseId).toBe(normalNextId)
    })

    test('an unresolved predicate name falls through without throwing', () => {
      const emptyRegistry: PredicateRegistry = { resolve: () => undefined }
      const state: EngineState = { ...initialEngineState(customConditionGraph), status: 'running' }
      const next = engineReducer(state, { type: 'advance-phase', now }, customConditionGraph, { predicateRegistry: emptyRegistry })
      expect(next.currentPhaseId).toBe(normalNextId)
    })

    test('omitting PredicateRegistry entirely treats every custom condition as unsatisfied', () => {
      const state: EngineState = { ...initialEngineState(customConditionGraph), status: 'running' }
      const next = engineReducer(state, { type: 'advance-phase', now }, customConditionGraph)
      expect(next.currentPhaseId).toBe(normalNextId)
    })

    test('every candidate unsatisfied transitions status to ended', () => {
      const onlyCustomGraph: PhaseGraph = PhaseGraphSchema.parse({
        id: 'only-custom',
        name: 'Only custom graph',
        phases: [
          PhaseSchema.parse({ ...phaseDefaults, id: 'weights', label: 'Weights', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
          PhaseSchema.parse({ ...phaseDefaults, id: 'skip-to', label: 'Skip to', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
        ],
        transitions: [
          { fromPhaseId: 'weights', toPhaseId: 'skip-to', condition: { kind: 'custom', predicate: isRestDayName } },
        ],
      })
      const state: EngineState = { ...initialEngineState(onlyCustomGraph), status: 'running' }
      const next = engineReducer(state, { type: 'advance-phase', now }, onlyCustomGraph, { predicateRegistry: registryResolvingTo(false) })
      expect(next.status).toBe('ended')
    })
  })

  describe('queueExhausted TransitionCondition resolution', () => {
    const doneId = PhaseIdSchema.parse('done')
    const setId = PhaseIdSchema.parse('set')

    const queueExhaustedGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'queue-exhausted',
      name: 'Queue exhausted graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, id: 'set', label: 'Set', kind: 'set', duration: null, logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'done', label: 'Done', kind: 'done', duration: null, logTarget: { kind: 'activeItem' } }),
      ],
      transitions: [
        { fromPhaseId: 'set', toPhaseId: 'done', condition: { kind: 'queueExhausted' } },
        { fromPhaseId: 'set', toPhaseId: 'set', condition: { kind: 'always' } },
      ],
    })

    test('state.queueExhausted true satisfies the queueExhausted transition', () => {
      const state: EngineState = { ...initialEngineState(queueExhaustedGraph), status: 'running', queueExhausted: true }
      const next = engineReducer(state, { type: 'advance-phase', now }, queueExhaustedGraph)
      expect(next.currentPhaseId).toBe(doneId)
    })

    test('state.queueExhausted false falls through to the next candidate', () => {
      const state: EngineState = { ...initialEngineState(queueExhaustedGraph), status: 'running', queueExhausted: false }
      const next = engineReducer(state, { type: 'advance-phase', now }, queueExhaustedGraph)
      expect(next.currentPhaseId).toBe(setId)
    })

    test('queueExhausted defaults to false from initialEngineState, so a fresh graph loops rather than skipping to done', () => {
      const state: EngineState = { ...initialEngineState(queueExhaustedGraph), status: 'running' }
      const next = engineReducer(state, { type: 'advance-phase', now }, queueExhaustedGraph)
      expect(next.currentPhaseId).toBe(setId)
    })
  })
})
