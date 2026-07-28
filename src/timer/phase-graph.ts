import { Temporal } from 'temporal-polyfill'
import { PhaseKindSchema, PhaseSchema } from '../domain/phase/phase'
import type { Phase, PhaseId } from '../domain/phase/phase'
import { PhaseGraphIdSchema, PhaseGraphSchema } from '../domain/phase/phase-graph'
import type { PhaseGraph, TransitionCondition } from '../domain/phase/phase-graph'
import type { PredicateRegistry } from '../domain/hook/predicate'
import { TaskSourceIdSchema } from '../domain/queue/task-source'
import { WRITE_BACK_HOOK_NAME } from './write-back'

/** Built-in phase kinds used by the default phase graph. */
export const FOCUS_PHASE_KIND = PhaseKindSchema.parse('focus')
export const BREAK_PHASE_KIND = PhaseKindSchema.parse('break')

/**
 * The two fixed queue ids RoutineTimerView registers a BaseQuerySource
 * under (see openspec/changes/base-query-task-source/design.md's Non-Goals —
 * arbitrary per-phase Bases filters are out of scope; every focus-kind phase
 * shares one queue, every break-kind phase shares the other).
 */
export const FOCUS_QUEUE_TASK_SOURCE_ID = TaskSourceIdSchema.parse('focus-queue')
export const BREAK_QUEUE_TASK_SOURCE_ID = TaskSourceIdSchema.parse('break-queue')

/**
 * Look up a phase by id within a graph. Returns undefined rather than
 * throwing — callers that need an invariant (the reducer) throw themselves;
 * UI code can fall back to rendering nothing.
 */
export function findPhaseById(graph: PhaseGraph, id: PhaseId): Phase | undefined {
  return graph.phases.find(phase => phase.id === id)
}

/**
 * Resolve which phase to enter next from `fromPhaseId`, evaluating
 * transitions in declared array order and taking the first whose condition
 * is satisfied — so a graph author puts exception branches (e.g. everyNth,
 * custom, queueExhausted) before the fallback 'always' branch.
 *
 * Throws if no outgoing transition matches (a misconfigured graph). A
 * 'custom' condition whose predicate doesn't resolve via `predicateRegistry`
 * (or when no registry is supplied at all) is treated as not satisfied,
 * matching Hook's "unresolved name => no-op" precedent, rather than
 * throwing. `queueExhausted` defaults to false for the same reason — a
 * caller that doesn't track it (e.g. a direct unit test) shouldn't have that
 * branch fire unexpectedly.
 */
export function resolveNextPhaseId(
  graph: PhaseGraph,
  fromPhaseId: PhaseId,
  visitCounts: Readonly<Record<PhaseId, number>>,
  predicateRegistry?: PredicateRegistry,
  queueExhausted = false,
): PhaseId {
  const candidates = graph.transitions.filter(transition => transition.fromPhaseId === fromPhaseId)
  for (const transition of candidates) {
    if (isConditionSatisfied(transition.condition, fromPhaseId, visitCounts, predicateRegistry, queueExhausted)) {
      return transition.toPhaseId
    }
  }
  throw new Error(`PhaseGraph "${graph.id}" has no eligible transition from phase "${fromPhaseId}"`)
}

function isConditionSatisfied(
  condition: TransitionCondition,
  fromPhaseId: PhaseId,
  visitCounts: Readonly<Record<PhaseId, number>>,
  predicateRegistry: PredicateRegistry | undefined,
  queueExhausted: boolean,
): boolean {
  switch (condition.kind) {
    case 'always':
      return true
    case 'everyNth':
      return (visitCounts[fromPhaseId] ?? 0) % condition.n === 0
    case 'custom': {
      const predicate = predicateRegistry?.resolve(condition.predicate)
      return predicate !== undefined && predicate(fromPhaseId, visitCounts)
    }
    case 'queueExhausted':
      return queueExhausted
  }
}

const phaseDefaults = {
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  onEnter: null,
  onComplete: { name: WRITE_BACK_HOOK_NAME, params: {} },
  onSkip: null,
  onExit: null,
} as const

const focusPhase: Phase = PhaseSchema.parse({
  ...phaseDefaults,
  id: 'focus',
  label: 'Focus',
  kind: FOCUS_PHASE_KIND,
  duration: Temporal.Duration.from({ minutes: 25 }),
  logTarget: { kind: 'activeItem' },
  taskSourceId: FOCUS_QUEUE_TASK_SOURCE_ID,
})

const breakPhase: Phase = PhaseSchema.parse({
  ...phaseDefaults,
  id: 'break',
  label: 'Short break',
  kind: BREAK_PHASE_KIND,
  duration: Temporal.Duration.from({ minutes: 5 }),
  logTarget: { kind: 'callback', name: 'dailyNote' },
  taskSourceId: BREAK_QUEUE_TASK_SOURCE_ID,
})

const longBreakPhase: Phase = PhaseSchema.parse({
  ...phaseDefaults,
  id: 'long-break',
  label: 'Long break',
  kind: BREAK_PHASE_KIND,
  duration: Temporal.Duration.from({ minutes: 15 }),
  logTarget: { kind: 'callback', name: 'dailyNote' },
  taskSourceId: BREAK_QUEUE_TASK_SOURCE_ID,
})

/**
 * Built-in default phase graph: 25 min focus → 5 min break, repeating,
 * with a 15 min long break every 4th focus phase.
 */
export const DEFAULT_PHASE_GRAPH: PhaseGraph = PhaseGraphSchema.parse({
  id: PhaseGraphIdSchema.parse('default'),
  name: 'Default routine',
  phases: [focusPhase, breakPhase, longBreakPhase],
  transitions: [
    { fromPhaseId: focusPhase.id, toPhaseId: longBreakPhase.id, condition: { kind: 'everyNth', n: 4 } },
    { fromPhaseId: focusPhase.id, toPhaseId: breakPhase.id, condition: { kind: 'always' } },
    { fromPhaseId: breakPhase.id, toPhaseId: focusPhase.id, condition: { kind: 'always' } },
    { fromPhaseId: longBreakPhase.id, toPhaseId: focusPhase.id, condition: { kind: 'always' } },
  ],
})
