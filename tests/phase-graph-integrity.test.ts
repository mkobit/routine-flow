import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { PhaseSchema, PhaseNodeSchema, PhaseIdSchema, SELECTOR_PHASE_KIND, FOCUS_PHASE_KIND, BREAK_PHASE_KIND } from '../src/domain/phase/phase'
import { PhaseGraphIdSchema, PhaseGraphSchema, checkPhaseGraphIntegrity } from '../src/domain/phase/phase-graph'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import { resolveNextPhaseId, findNextPhase, hasQueueExhaustedTransition } from '../src/timer/phase-graph-query'
import { formatPhaseHeader } from '../src/timer/format'
import type { EngineState } from '../src/domain/session/engine-state'

const phaseDefaults = {
  name: 'Phase',
  label: 'Phase',
  kind: 'focus',
  duration: Temporal.Duration.from({ seconds: 10 }),
  onCompletion: 'autoAdvance',
  taskSourceId: null,
  logTarget: { kind: 'activeItem' },
  handlers: {
    onEnter: [],
    onComplete: [],
    onSkip: [],
    onExit: [],
  },
}

function phase(id: string) {
  return PhaseSchema.parse({ ...phaseDefaults, id })
}

function graph(phases: unknown[], transitions: unknown[]): PhaseGraph {
  return PhaseGraphSchema.parse({ id: 'test', name: 'Test graph', phases, transitions })
}

describe('checkPhaseGraphIntegrity', () => {
  test('a well-formed two-phase cycle has no issues', () => {
    const g = graph(
      [phase('focus'), phase('break')],
      [
        { from: 'focus', to: 'break', guard: { kind: 'always' } },
        { from: 'break', to: 'focus', guard: { kind: 'always' } },
      ],
    )
    expect(checkPhaseGraphIntegrity(g)).toEqual([])
  })

  test('flags a duplicated phase id', () => {
    const g = graph(
      [phase('focus'), phase('focus')],
      [{ from: 'focus', to: 'focus', guard: { kind: 'always' } }],
    )
    const issues = checkPhaseGraphIntegrity(g)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toBe('Phase id "focus" is declared more than once.')
  })

  test('flags a transition whose from phase id does not exist', () => {
    const g = graph(
      [phase('focus')],
      [{ from: 'ghost', to: 'focus', guard: { kind: 'always' } }],
    )
    const issues = checkPhaseGraphIntegrity(g)
    expect(issues.some(issue => issue.message.includes('"ghost"'))).toBe(true)
  })

  test('flags a transition whose to phase id does not exist', () => {
    const g = graph(
      [phase('focus')],
      [{ from: 'focus', to: 'ghost', guard: { kind: 'always' } }],
    )
    const issues = checkPhaseGraphIntegrity(g)
    expect(issues.some(issue => issue.message.includes('"ghost"'))).toBe(true)
  })

  test('accepts a reachable terminal phase with zero outgoing transitions', () => {
    const g = graph(
      [phase('focus'), phase('dead-end')],
      [{ from: 'focus', to: 'dead-end', guard: { kind: 'always' } }],
    )
    const issues = checkPhaseGraphIntegrity(g)
    expect(issues).toEqual([])
  })
})

describe('PhaseNodeSchema selector configuration', () => {
  test('parses phase node with explicit selector config', () => {
    const node = PhaseNodeSchema.parse({
      ...phaseDefaults,
      id: 'selector-stage',
      kind: SELECTOR_PHASE_KIND,
      selector: { autoSpin: true, promoteToFront: true },
    })
    expect(node.kind).toBe(SELECTOR_PHASE_KIND)
    expect(node.selector).toEqual({ autoSpin: true, promoteToFront: true })
  })

  test('defaults promoteToFront and autoSpin when empty selector object is provided', () => {
    const node = PhaseNodeSchema.parse({
      ...phaseDefaults,
      id: 'selector-stage',
      kind: SELECTOR_PHASE_KIND,
      selector: {},
    })
    expect(node.selector).toEqual({ autoSpin: false, promoteToFront: false })
  })

  test('normalizes flattened autoSpin and promoteToFront properties into selector object', () => {
    const node = PhaseNodeSchema.parse({
      ...phaseDefaults,
      id: 'selector-stage',
      kind: 'selector',
      autoSpin: true,
      promoteToFront: true,
    })
    expect(node.kind).toBe(SELECTOR_PHASE_KIND)
    expect(node.selector).toEqual({ autoSpin: true, promoteToFront: true })
  })

  test('leaves selector undefined when omitted or explicitly null', () => {
    const nodeWithoutSelector = PhaseNodeSchema.parse({
      ...phaseDefaults,
      id: 'focus-stage',
    })
    expect(nodeWithoutSelector.selector).toBeUndefined()

    const nodeWithNullSelector = PhaseNodeSchema.parse({
      ...phaseDefaults,
      id: 'focus-stage-2',
      selector: null,
    })
    expect(nodeWithNullSelector.selector).toBeUndefined()
  })
})

describe('phase graph serialization and parsing with selector phases', () => {
  test('serializes to JSON and round-trips phase graph containing selector phases', () => {
    const selectorPhase = {
      id: 'select',
      name: 'Wheel of tasks',
      label: 'Wheel of tasks',
      kind: 'selector',
      duration: 'PT30S',
      onCompletion: 'autoAdvance',
      taskSourceId: null,
      selector: { autoSpin: true, promoteToFront: true },
      handlers: {
        onEnter: [],
        onComplete: [],
        onSkip: [],
        onExit: [],
      },
    }
    const focusNode = {
      id: 'focus',
      name: 'Focus',
      label: 'Focus',
      kind: 'focus',
      duration: 'PT25M',
      onCompletion: 'autoAdvance',
      taskSourceId: null,
      handlers: {
        onEnter: [],
        onComplete: [],
        onSkip: [],
        onExit: [],
      },
    }
    const originalJson = JSON.stringify({
      id: 'roulette-routine',
      name: 'Roulette routine',
      phases: [
        {
          ...selectorPhase,
          duration: { seconds: 30 },
        },
        {
          ...focusNode,
          duration: { minutes: 25 },
        },
      ],
      transitions: [
        { from: 'select', to: 'focus', guard: { kind: 'always' } },
        { from: 'focus', to: 'select', guard: { kind: 'always' } },
      ],
    })

    const parsed = PhaseGraphSchema.parse(JSON.parse(originalJson))
    expect(parsed.phases).toHaveLength(2)
    expect(parsed.phases[0]?.kind).toBe(SELECTOR_PHASE_KIND)
    expect(parsed.phases[0]?.selector).toEqual({ autoSpin: true, promoteToFront: true })
    expect(checkPhaseGraphIntegrity(parsed)).toEqual([])
  })
})

describe('phase resolvers with selector phases', () => {
  test('resolves transition from selector phase into focus phase', () => {
    const selectorPhase = PhaseSchema.parse({
      ...phaseDefaults,
      id: 'select',
      kind: SELECTOR_PHASE_KIND,
      selector: { autoSpin: true, promoteToFront: true },
    })
    const focusPhase = PhaseSchema.parse({
      ...phaseDefaults,
      id: 'focus',
      kind: FOCUS_PHASE_KIND,
    })
    const g = graph(
      [selectorPhase, focusPhase],
      [{ from: 'select', to: 'focus', guard: { kind: 'always' } }],
    )

    const nextId = resolveNextPhaseId(g, selectorPhase.id, { [selectorPhase.id]: 1, [focusPhase.id]: 0 })
    expect(nextId).toBe(focusPhase.id)

    const fakeEngineState: EngineState = {
      status: 'running',
      phaseGraphId: PhaseGraphIdSchema.parse('test'),
      currentPhaseId: selectorPhase.id,
      remaining: Temporal.Duration.from({ seconds: 10 }),
      phaseVisitCounts: { [selectorPhase.id]: 0 },
      activeFilePath: null,
      queueExhausted: false,
      session: null,
    }
    const nextPhase = findNextPhase(g, fakeEngineState)
    expect(nextPhase?.id).toBe(focusPhase.id)
    expect(nextPhase?.kind).toBe(FOCUS_PHASE_KIND)
  })

  test('resolves transition from break phase into selector phase', () => {
    const breakPhase = PhaseSchema.parse({
      ...phaseDefaults,
      id: 'break',
      kind: BREAK_PHASE_KIND,
    })
    const selectorPhase = PhaseSchema.parse({
      ...phaseDefaults,
      id: 'select',
      kind: SELECTOR_PHASE_KIND,
      selector: { autoSpin: false, promoteToFront: true },
    })
    const g = graph(
      [breakPhase, selectorPhase],
      [{ from: 'break', to: 'select', guard: { kind: 'always' } }],
    )

    const nextId = resolveNextPhaseId(g, breakPhase.id, { [breakPhase.id]: 1, [selectorPhase.id]: 0 })
    expect(nextId).toBe(selectorPhase.id)

    const fakeEngineState: EngineState = {
      status: 'running',
      phaseGraphId: PhaseGraphIdSchema.parse('test'),
      currentPhaseId: breakPhase.id,
      remaining: Temporal.Duration.from({ seconds: 5 }),
      phaseVisitCounts: { [breakPhase.id]: 0 },
      activeFilePath: null,
      queueExhausted: false,
      session: null,
    }
    const nextPhase = findNextPhase(g, fakeEngineState)
    expect(nextPhase?.id).toBe(selectorPhase.id)
    expect(nextPhase?.kind).toBe(SELECTOR_PHASE_KIND)
    expect(nextPhase?.selector).toEqual({ autoSpin: false, promoteToFront: true })
  })
})

describe('view headers and queue titles with selector phases', () => {
  test('formats phase header for duration-less selector phase', () => {
    const selectorPhase = PhaseSchema.parse({
      ...phaseDefaults,
      id: 'wheel',
      name: 'Wheel of tasks',
      label: 'Wheel of tasks',
      kind: SELECTOR_PHASE_KIND,
      duration: null,
    })
    expect(formatPhaseHeader(selectorPhase, null, 'running')).toBe('Wheel of tasks (running)')
  })

  test('formats phase header for timed selector phase', () => {
    const selectorPhase = PhaseSchema.parse({
      ...phaseDefaults,
      id: 'wheel',
      name: 'Wheel of tasks',
      label: 'Wheel of tasks',
      kind: SELECTOR_PHASE_KIND,
      duration: Temporal.Duration.from({ seconds: 30 }),
    })
    expect(formatPhaseHeader(selectorPhase, Temporal.Duration.from({ seconds: 30 }), 'running')).toBe('Wheel of tasks: 00:30 (running)')
  })

  test('validates phase graph with completedItems log target', () => {
    const blitzPhase = PhaseSchema.parse({
      ...phaseDefaults,
      id: 'blitz',
      kind: FOCUS_PHASE_KIND,
      logTarget: { kind: 'completedItems' },
    })
    const g = graph([blitzPhase], [{ from: 'blitz', to: 'blitz', guard: { kind: 'always' } }])
    expect(checkPhaseGraphIntegrity(g)).toEqual([])
  })

  test('hasQueueExhaustedTransition returns true when outgoing transition has queueExhausted guard', () => {
    const g = graph(
      [phase('blitz'), phase('wrapup')],
      [
        { from: 'blitz', to: 'wrapup', guard: { kind: 'queueExhausted' } },
        { from: 'wrapup', to: 'blitz', guard: { kind: 'always' } },
      ],
    )
    expect(hasQueueExhaustedTransition(g, PhaseIdSchema.parse('blitz'))).toBe(true)
    expect(hasQueueExhaustedTransition(g, PhaseIdSchema.parse('wrapup'))).toBe(false)
  })
})
