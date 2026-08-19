import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { PhaseSchema } from '../src/domain/phase/phase'
import { PhaseGraphSchema, checkPhaseGraphIntegrity } from '../src/domain/phase/phase-graph'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'

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
