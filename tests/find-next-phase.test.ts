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
import { findNextPhase, DEFAULT_PHASE_GRAPH } from '../src/timer/phase-graph'
import { initialEngineState } from '../src/timer/reducer'
import { PhaseGraphSchema } from '../src/domain/phase/phase-graph'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import { PhaseSchema, PhaseIdSchema } from '../src/domain/phase/phase'
import type { EngineState } from '../src/domain/session/engine-state'

const focusId = PhaseIdSchema.parse('focus')
const breakId = PhaseIdSchema.parse('break')
const longBreakId = PhaseIdSchema.parse('long-break')

const phaseDefaults = {
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  onEnter: null,
  onComplete: null,
  onSkip: null,
  onExit: null,
} as const

describe('findNextPhase', () => {
  test('returns Short break for initial focus phase in default graph', () => {
    const state = initialEngineState(DEFAULT_PHASE_GRAPH)
    const next = findNextPhase(DEFAULT_PHASE_GRAPH, state)
    expect(next?.id).toBe(breakId)
    expect(next?.label).toBe('Short break')
  })

  test('returns Focus for break phase in default graph', () => {
    const state: EngineState = {
      ...initialEngineState(DEFAULT_PHASE_GRAPH),
      currentPhaseId: breakId,
      phaseVisitCounts: { [focusId]: 1 },
    }
    const next = findNextPhase(DEFAULT_PHASE_GRAPH, state)
    expect(next?.id).toBe(focusId)
    expect(next?.label).toBe('Focus')
  })

  test('returns Long break for 4th focus phase (visit count 3) in default graph', () => {
    const state: EngineState = {
      ...initialEngineState(DEFAULT_PHASE_GRAPH),
      currentPhaseId: focusId,
      phaseVisitCounts: { [focusId]: 3 },
    }
    const next = findNextPhase(DEFAULT_PHASE_GRAPH, state)
    expect(next?.id).toBe(longBreakId)
    expect(next?.label).toBe('Long break')
  })

  test('returns Focus for long break phase in default graph', () => {
    const state: EngineState = {
      ...initialEngineState(DEFAULT_PHASE_GRAPH),
      currentPhaseId: longBreakId,
      phaseVisitCounts: { [focusId]: 4 },
    }
    const next = findNextPhase(DEFAULT_PHASE_GRAPH, state)
    expect(next?.id).toBe(focusId)
    expect(next?.label).toBe('Focus')
  })

  test('returns undefined for invalid currentPhaseId', () => {
    const state: EngineState = {
      ...initialEngineState(DEFAULT_PHASE_GRAPH),
      currentPhaseId: PhaseIdSchema.parse('non-existent'),
    }
    const next = findNextPhase(DEFAULT_PHASE_GRAPH, state)
    expect(next).toBeUndefined()
  })

  test('returns undefined if no transition condition is satisfied', () => {
    const noTransitionGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'no-trans',
      name: 'No transition graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, id: 'alone', label: 'Alone', kind: 'focus', duration: Temporal.Duration.from({ seconds: 300 }), logTarget: { kind: 'activeItem' } }),
      ],
      transitions: [],
    })
    const state = initialEngineState(noTransitionGraph)
    const next = findNextPhase(noTransitionGraph, state)
    expect(next).toBeUndefined()
  })
})
