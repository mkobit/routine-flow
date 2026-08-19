import { describe, expect, test } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { parseRoutineFile } from '../src/domain/routine/routine-file'
import { engineReducer, initialEngineState } from '../src/timer/reducer'
import { PhaseIdSchema } from '../src/domain/phase/phase'

function wrapInRoutineNote(graphJson: object): string {
  return `---
is-routine: true
---

# Routine Example

\`\`\`json
${JSON.stringify(graphJson, null, 2)}
\`\`\`
`
}

describe('routine examples validation', () => {
  test('pomodoro with variable break duration ladder evaluates everyNth transitions correctly', () => {
    const ladderRoutine = {
      id: 'pomodoro-ladder',
      name: 'Pomodoro with break ladder',
      phases: [
        {
          id: 'focus',
          name: 'Focus',
          label: 'Focus',
          kind: 'focus',
          duration: 'PT25M',
          onCompletion: 'autoAdvance',
          handlers: {},
        },
        {
          id: 'long-break',
          name: 'Long break',
          label: 'Long break',
          kind: 'break',
          duration: 'PT15M',
          onCompletion: 'autoAdvance',
          handlers: {},
        },
        {
          id: 'medium-break',
          name: 'Medium break',
          label: 'Medium break',
          kind: 'break',
          duration: 'PT10M',
          onCompletion: 'autoAdvance',
          handlers: {},
        },
        {
          id: 'short-break',
          name: 'Short break',
          label: 'Short break',
          kind: 'break',
          duration: 'PT5M',
          onCompletion: 'autoAdvance',
          handlers: {},
        },
      ],
      transitions: [
        { from: 'focus', to: 'long-break', guard: { kind: 'everyNth', count: 4 } },
        { from: 'focus', to: 'medium-break', guard: { kind: 'everyNth', count: 2 } },
        { from: 'focus', to: 'short-break', guard: { kind: 'always' } },
        { from: 'long-break', to: 'focus', guard: { kind: 'always' } },
        { from: 'medium-break', to: 'focus', guard: { kind: 'always' } },
        { from: 'short-break', to: 'focus', guard: { kind: 'always' } },
      ],
    }

    const parseResult = parseRoutineFile(wrapInRoutineNote(ladderRoutine))
    expect(parseResult.success).toBe(true)
    if (!parseResult.success) {
      return
    }

    const graph = parseResult.graph
    const now = Temporal.Now.instant()
    let state = initialEngineState(graph)
    state = engineReducer(state, { type: 'start', now }, graph)

    // Cycle 1: focus -> short-break (count = 1)
    state = engineReducer(state, { type: 'finish-phase', now }, graph)
    expect(state.currentPhaseId).toBe(PhaseIdSchema.parse('short-break'))
    state = engineReducer(state, { type: 'finish-phase', now }, graph)
    expect(state.currentPhaseId).toBe(PhaseIdSchema.parse('focus'))

    // Cycle 2: focus -> medium-break (count = 2)
    state = engineReducer(state, { type: 'finish-phase', now }, graph)
    expect(state.currentPhaseId).toBe(PhaseIdSchema.parse('medium-break'))
    state = engineReducer(state, { type: 'finish-phase', now }, graph)
    expect(state.currentPhaseId).toBe(PhaseIdSchema.parse('focus'))

    // Cycle 3: focus -> short-break (count = 3)
    state = engineReducer(state, { type: 'finish-phase', now }, graph)
    expect(state.currentPhaseId).toBe(PhaseIdSchema.parse('short-break'))
    state = engineReducer(state, { type: 'finish-phase', now }, graph)
    expect(state.currentPhaseId).toBe(PhaseIdSchema.parse('focus'))

    // Cycle 4: focus -> long-break (count = 4)
    state = engineReducer(state, { type: 'finish-phase', now }, graph)
    expect(state.currentPhaseId).toBe(PhaseIdSchema.parse('long-break'))
  })

  test('workout routine with manual rep phases and terminal cool-down advances to ended status', () => {
    const workoutRoutine = {
      id: 'workout-routine',
      name: 'Workout with rep sets',
      phases: [
        {
          id: 'warmup',
          name: 'Warm-up',
          duration: 'PT3M',
          onCompletion: 'autoAdvance',
          handlers: {},
        },
        {
          id: 'set-1',
          name: 'Push-ups Set 1',
          duration: null,
          onCompletion: 'waitForManual',
          handlers: {},
        },
        {
          id: 'rest-1',
          name: 'Rest',
          duration: 'PT1M',
          onCompletion: 'autoAdvance',
          handlers: {},
        },
        {
          id: 'cooldown',
          name: 'Cool-down',
          duration: 'PT2M',
          onCompletion: 'autoAdvance',
          handlers: {},
        },
      ],
      transitions: [
        { from: 'warmup', to: 'set-1', guard: { kind: 'always' } },
        { from: 'set-1', to: 'rest-1', guard: { kind: 'always' } },
        { from: 'rest-1', to: 'cooldown', guard: { kind: 'always' } },
      ],
    }

    const parseResult = parseRoutineFile(wrapInRoutineNote(workoutRoutine))
    expect(parseResult.success).toBe(true)
    if (!parseResult.success) {
      return
    }

    const graph = parseResult.graph
    const now = Temporal.Now.instant()
    let state = initialEngineState(graph)
    state = engineReducer(state, { type: 'start', now }, graph)
    expect(state.currentPhaseId).toBe(PhaseIdSchema.parse('warmup'))

    // Warm-up completes -> set-1 (manual phase with duration: null)
    state = engineReducer(state, { type: 'finish-phase', now }, graph)
    expect(state.currentPhaseId).toBe(PhaseIdSchema.parse('set-1'))
    expect(state.remaining).toBeNull()

    // set-1 manual completion -> rest-1
    state = engineReducer(state, { type: 'advance-phase', now }, graph)
    expect(state.currentPhaseId).toBe(PhaseIdSchema.parse('rest-1'))
    expect(state.remaining?.total({ unit: 'seconds' })).toBe(60)

    // rest-1 completes -> cooldown (terminal node)
    state = engineReducer(state, { type: 'finish-phase', now }, graph)
    expect(state.currentPhaseId).toBe(PhaseIdSchema.parse('cooldown'))

    // cooldown completes -> transitions to ended status because there are no outgoing transitions
    state = engineReducer(state, { type: 'finish-phase', now }, graph)
    expect(state.status).toBe('ended')
  })

  test('chore list routine with queue actions parses and validates action payloads', () => {
    const choreRoutine = {
      id: 'chore-list',
      name: 'Chore list routine',
      phases: [
        {
          id: 'chore',
          name: 'Chore task',
          duration: null,
          onCompletion: 'waitForManual',
          taskSourceId: 'chore-queue',
          actions: [
            { id: 'done', label: 'Done', style: 'primary', payload: { kind: 'markDone' } },
            { id: 'cycle', label: 'Cycle to back', payload: { kind: 'queueCycle' } },
            { id: 'defer', label: 'Defer 1 day', payload: { kind: 'deferDuration', after: 'P1D' } },
            { id: 'p1', label: 'Set high priority', payload: { kind: 'setFrontmatter', property: 'priority', value: 1 } },
          ],
          handlers: {},
        },
      ],
      transitions: [
        { from: 'chore', to: 'chore', guard: { kind: 'always' } },
      ],
    }

    const parseResult = parseRoutineFile(wrapInRoutineNote(choreRoutine))
    expect(parseResult.success).toBe(true)
    if (!parseResult.success) {
      return
    }

    const phase = parseResult.graph.phases[0]
    expect(phase?.actions).toHaveLength(4)
    expect(phase?.actions[0]?.payload.kind).toBe('markDone')
    expect(phase?.actions[1]?.payload.kind).toBe('queueCycle')
    expect(phase?.actions[2]?.payload.kind).toBe('deferDuration')
    expect(phase?.actions[3]?.payload.kind).toBe('setFrontmatter')
  })

  test('queue-exhausted branching routine routes to wrapup when queue is exhausted', () => {
    const sprintRoutine = {
      id: 'sprint-routine',
      name: 'Sprint tasks routine',
      phases: [
        {
          id: 'task-sprint',
          name: 'Sprint task',
          duration: 'PT20M',
          onCompletion: 'autoAdvance',
          taskSourceId: 'task-queue',
          handlers: {},
        },
        {
          id: 'wrapup',
          name: 'Sprint wrap-up',
          duration: 'PT10M',
          onCompletion: 'autoAdvance',
          handlers: {},
        },
      ],
      transitions: [
        { from: 'task-sprint', to: 'wrapup', guard: { kind: 'queueExhausted' } },
        { from: 'task-sprint', to: 'task-sprint', guard: { kind: 'always' } },
      ],
    }

    const parseResult = parseRoutineFile(wrapInRoutineNote(sprintRoutine))
    expect(parseResult.success).toBe(true)
    if (!parseResult.success) {
      return
    }

    const graph = parseResult.graph
    const now = Temporal.Now.instant()

    // When queue is NOT exhausted, complete-phase loops on task-sprint
    let state = initialEngineState(graph)
    state = engineReducer(state, { type: 'start', now }, graph)
    state = engineReducer(state, { type: 'finish-phase', now }, graph)
    expect(state.currentPhaseId).toBe(PhaseIdSchema.parse('task-sprint'))

    // When queue IS exhausted, complete-phase branches to wrapup
    state = engineReducer(state, { type: 'set-queue-exhausted', exhausted: true }, graph)
    state = engineReducer(state, { type: 'finish-phase', now }, graph)
    expect(state.currentPhaseId).toBe(PhaseIdSchema.parse('wrapup'))
  })

  test('custom script and preset handlers parse and validate successfully', () => {
    const customHookRoutine = {
      id: 'custom-hooks-routine',
      name: 'Routine with custom handlers',
      phases: [
        {
          id: 'study',
          name: 'Study block',
          duration: 'PT50M',
          onCompletion: 'autoAdvance',
          handlers: {
            onEnter: [
              {
                kind: 'preset',
                preset: 'notify',
                params: {
                  body: 'Study block started',
                },
              },
            ],
            onComplete: [
              {
                kind: 'script',
                scriptPath: 'scripts/log-study-session.js',
                params: {
                  topic: 'TypeScript',
                },
              },
            ],
          },
        },
      ],
      transitions: [],
    }

    const parseResult = parseRoutineFile(wrapInRoutineNote(customHookRoutine))
    expect(parseResult.success).toBe(true)
    if (!parseResult.success) {
      return
    }

    const phase = parseResult.graph.phases[0]
    expect(phase?.handlers.onEnter).toHaveLength(1)
    expect(phase?.handlers.onEnter?.[0]?.kind).toBe('preset')
    expect(phase?.handlers.onComplete).toHaveLength(1)
    expect(phase?.handlers.onComplete?.[0]?.kind).toBe('script')
  })
})
