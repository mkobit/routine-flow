import { Temporal } from 'temporal-polyfill'
import { PhaseKindSchema, PhaseNodeSchema } from '../domain/phase/phase'
import type { PhaseNode, PhaseId } from '../domain/phase/phase'
import { PhaseGraphIdSchema, PhaseGraphSchema } from '../domain/phase/phase-graph'
import type { PhaseGraph, EdgeGuard } from '../domain/phase/phase-graph'
import type { EngineState } from '../domain/session/engine-state'
import type { PredicateRegistry } from '../domain/hook/predicate'
import { PredicateNameSchema } from '../domain/hook/predicate'
import { TaskSourceIdSchema } from '../domain/queue/task-source'

/** Built-in phase kinds used by the default phase graph. */
export const FOCUS_PHASE_KIND = PhaseKindSchema.parse('focus')
export const BREAK_PHASE_KIND = PhaseKindSchema.parse('break')

export const FOCUS_QUEUE_TASK_SOURCE_ID = TaskSourceIdSchema.parse('focus-queue')
export const BREAK_QUEUE_TASK_SOURCE_ID = TaskSourceIdSchema.parse('break-queue')

function getGuardRecord(guard: EdgeGuard): Record<string, unknown> {
  return typeof guard === 'object' && guard !== null ? Object(guard) : {}
}

/**
 * Look up a phase node by id within a graph.
 */
export function findPhaseById(graph: PhaseGraph, id: PhaseId): PhaseNode | undefined {
  return graph.phases.find((phase: PhaseNode) => phase.id === id)
}

/**
 * Resolves the next phase that will be entered after the current phase in `state`
 * completes or advances.
 */
export function findNextPhase(
  graph: PhaseGraph,
  state: EngineState,
  predicateRegistry?: PredicateRegistry,
): PhaseNode | undefined {
  const currentPhase = findPhaseById(graph, state.currentPhaseId)
  if (!currentPhase) {
    return undefined
  }
  const updatedCounts: Record<PhaseId, number> = {
    ...state.phaseVisitCounts,
    [state.currentPhaseId]: (state.phaseVisitCounts[state.currentPhaseId] ?? 0) + 1,
  }
  const nextPhaseId = resolveNextPhaseId(graph, state.currentPhaseId, updatedCounts, predicateRegistry, state.queueExhausted)
  if (nextPhaseId === null) {
    return undefined
  }
  return findPhaseById(graph, nextPhaseId)
}

/**
 * Resolve which phase to enter next from `fromPhaseId`.
 */
export function resolveNextPhaseId(
  graph: PhaseGraph,
  fromPhaseId: PhaseId,
  visitCounts: Readonly<Record<PhaseId, number>>,
  predicateRegistry?: PredicateRegistry,
  queueExhausted = false,
): PhaseId | null {
  const candidates = graph.transitions.filter(transition => transition.from === fromPhaseId || transition.fromPhaseId === fromPhaseId)
  for (const transition of candidates) {
    const guard = transition.guard ?? transition.condition
    if (isGuardSatisfied(guard, fromPhaseId, visitCounts, predicateRegistry, queueExhausted)) {
      return transition.to ?? transition.toPhaseId
    }
  }
  return null
}

function isGuardSatisfied(
  guard: EdgeGuard,
  fromPhaseId: PhaseId,
  visitCounts: Readonly<Record<PhaseId, number>>,
  predicateRegistry: PredicateRegistry | undefined,
  queueExhausted: boolean,
): boolean {
  switch (guard.kind) {
    case 'always':
      return true
    case 'everyNth': {
      const rec = getGuardRecord(guard)
      const count = typeof guard.count === 'number' ? guard.count : (typeof rec.n === 'number' ? rec.n : 1)
      return (visitCounts[fromPhaseId] ?? 0) % count === 0
    }
    case 'custom': {
      const rec = getGuardRecord(guard)
      const predicateName = typeof guard.predicateName === 'string' ? guard.predicateName : (typeof rec.predicate === 'string' ? rec.predicate : undefined)
      const predicate = predicateName !== undefined ? predicateRegistry?.resolve(PredicateNameSchema.parse(predicateName)) : undefined
      return predicate !== undefined && predicate(fromPhaseId, visitCounts)
    }
    case 'queueExhausted':
      return queueExhausted
  }
}

const focusPhase: PhaseNode = PhaseNodeSchema.parse({
  id: 'focus',
  name: 'Focus',
  label: 'Focus',
  kind: FOCUS_PHASE_KIND,
  duration: Temporal.Duration.from({ minutes: 25 }),
  logTarget: { kind: 'activeItem' },
  taskSourceId: FOCUS_QUEUE_TASK_SOURCE_ID,
  onCompletion: 'autoAdvance',
  handlers: {
    onComplete: [{ kind: 'preset', preset: 'setFrontmatter' }],
  },
})

const breakPhase: PhaseNode = PhaseNodeSchema.parse({
  id: 'break',
  name: 'Short break',
  label: 'Short break',
  kind: BREAK_PHASE_KIND,
  duration: Temporal.Duration.from({ minutes: 5 }),
  logTarget: { kind: 'activeItem' },
  taskSourceId: BREAK_QUEUE_TASK_SOURCE_ID,
  onCompletion: 'autoAdvance',
})

const longBreakPhase: PhaseNode = PhaseNodeSchema.parse({
  id: 'long-break',
  name: 'Long break',
  label: 'Long break',
  kind: BREAK_PHASE_KIND,
  duration: Temporal.Duration.from({ minutes: 15 }),
  logTarget: { kind: 'activeItem' },
  taskSourceId: BREAK_QUEUE_TASK_SOURCE_ID,
  onCompletion: 'autoAdvance',
})

export const DEFAULT_PHASE_GRAPH: PhaseGraph = PhaseGraphSchema.parse({
  id: PhaseGraphIdSchema.parse('default'),
  name: 'Default routine',
  phases: [focusPhase, breakPhase, longBreakPhase],
  transitions: [
    { from: focusPhase.id, to: longBreakPhase.id, guard: { kind: 'everyNth', count: 4 } },
    { from: focusPhase.id, to: breakPhase.id, guard: { kind: 'always' } },
    { from: breakPhase.id, to: focusPhase.id, guard: { kind: 'always' } },
    { from: longBreakPhase.id, to: focusPhase.id, guard: { kind: 'always' } },
  ],
})
