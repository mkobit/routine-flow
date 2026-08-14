import { z } from 'zod'
import { PhaseIdSchema, PhaseSchema } from './phase'
import type { Phase, PhaseId } from './phase'
import { PredicateNameSchema } from '../hook/predicate'

/**
 * Identifier for a PhaseGraph. Branded so it can't be mixed up with a PhaseId.
 */
export const PhaseGraphIdSchema = z.string().min(1).brand<'PhaseGraphId'>()
export type PhaseGraphId = z.infer<typeof PhaseGraphIdSchema>

/**
 * When a transition fires. 'everyNth' needs a visit counter, and
 * 'queueExhausted' needs the current phase's TaskSource queue length — both
 * are runtime state (see session/engine-state.ts's phaseVisitCounts and
 * queueExhausted) — not part of this static graph config.
 */
export const TransitionConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('always') }),
  z.object({ kind: z.literal('everyNth'), n: z.number().int().positive() }),
  z.object({ kind: z.literal('custom'), predicate: PredicateNameSchema }),
  z.object({ kind: z.literal('queueExhausted') }),
]).readonly()

export type TransitionCondition = z.infer<typeof TransitionConditionSchema>

/** An edge in a PhaseGraph: from one phase to another, under some condition. */
export const PhaseTransitionSchema = z.object({
  fromPhaseId: PhaseIdSchema,
  toPhaseId: PhaseIdSchema,
  condition: TransitionConditionSchema,
}).readonly()

export type PhaseTransition = z.infer<typeof PhaseTransitionSchema>

/**
 * A named graph of Phases plus the transitions between them. Supersedes the
 * flat, cyclic Workflow from flow-gu1.12 for routines that need branching
 * (e.g. a long break every 4th cycle, or skipping a phase based on a
 * predicate) — not wired into the currently-shipped reducer in this pass.
 */
export const PhaseGraphSchema = z.object({
  id: PhaseGraphIdSchema,
  name: z.string().min(1),
  phases: z.array(PhaseSchema).min(1),
  transitions: z.array(PhaseTransitionSchema),
  /** Optional theme/styling CSS class applied to containers for this routine. */
  cssClass: z.string().optional(),
}).readonly()

export type PhaseGraph = z.infer<typeof PhaseGraphSchema>

/** A referential-integrity problem PhaseGraphSchema's shape-only validation can't express. */
export interface PhaseGraphIntegrityIssue {
  readonly message: string
}

function distinct<T>(values: readonly T[]): readonly T[] {
  return values.filter((value, index) => values.indexOf(value) === index)
}

function duplicates(values: readonly PhaseId[]): readonly PhaseId[] {
  return distinct(values.filter((value, index) => values.indexOf(value) !== index))
}

function duplicatePhaseIdIssues(graph: PhaseGraph): readonly PhaseGraphIntegrityIssue[] {
  return duplicates(graph.phases.map(phase => phase.id))
    .map(id => ({ message: `Phase id "${id}" is declared more than once.` }))
}

function danglingTransitionIssues(graph: PhaseGraph): readonly PhaseGraphIntegrityIssue[] {
  const knownIds = graph.phases.map(phase => phase.id)
  const referencedIds = graph.transitions.flatMap(transition => [transition.fromPhaseId, transition.toPhaseId])
  return distinct(referencedIds.filter(id => !knownIds.includes(id)))
    .map(id => ({ message: `A transition references phase id "${id}", which isn't declared in this graph's phases.` }))
}

/** BFS outward from `visited`, following only transitions whose toPhaseId names a real phase. */
function nextReachableIds(graph: PhaseGraph, visited: readonly PhaseId[], knownIds: readonly PhaseId[]): readonly PhaseId[] {
  const discovered = distinct(
    visited
      .flatMap(id => graph.transitions.filter(transition => transition.fromPhaseId === id).map(transition => transition.toPhaseId))
      .filter(id => knownIds.includes(id) && !visited.includes(id)),
  )
  return discovered.length === 0 ? visited : nextReachableIds(graph, [...visited, ...discovered], knownIds)
}

function reachablePhases(graph: PhaseGraph): readonly Phase[] {
  const startId = graph.phases[0]?.id
  const reachableIds = startId === undefined ? [] : nextReachableIds(graph, [startId], graph.phases.map(phase => phase.id))
  return graph.phases.filter(phase => reachableIds.includes(phase.id))
}

function noOutgoingTransitionIssues(graph: PhaseGraph): readonly PhaseGraphIntegrityIssue[] {
  return reachablePhases(graph)
    .filter(phase => !graph.transitions.some(transition => transition.fromPhaseId === phase.id))
    .map(phase => ({ message: `Phase "${phase.id}" is reachable but has no outgoing transitions — the engine throws once it tries to advance past it.` }))
}

function allConditionalTransitionIssues(graph: PhaseGraph): readonly PhaseGraphIntegrityIssue[] {
  return reachablePhases(graph)
    .filter((phase) => {
      const outgoing = graph.transitions.filter(transition => transition.fromPhaseId === phase.id)
      return outgoing.length > 0 && !outgoing.some(transition => transition.condition.kind === 'always')
    })
    .map(phase => ({ message: `Phase "${phase.id}"'s outgoing transitions are all conditional (no unconditional "always" transition) — the engine throws if none of them match at runtime.` }))
}

/**
 * Referential-integrity checks PhaseGraphSchema's shape-only validation can't express: duplicate
 * phase ids, transitions referencing a phase id absent from `phases`, and phases reachable from the
 * graph's entry point (`phases[0]`) that either have no way out at all, or whose only ways out are
 * conditional (everyNth/custom) with no unconditional 'always' fallback — both throw at runtime
 * (resolveNextPhaseId's "no eligible transition") the moment the engine tries to advance past them.
 *
 * Deliberately not wired into PhaseGraphSchema itself: reducer-level tests construct graphs that
 * fail these checks on purpose, to exercise that runtime throw as a defense-in-depth safety net.
 * parseRoutineFile calls this separately instead, moving the failure to routine-file load time
 * (flow-gu1.31) without narrowing what PhaseGraphSchema.parse accepts directly.
 */
export function checkPhaseGraphIntegrity(graph: PhaseGraph): readonly PhaseGraphIntegrityIssue[] {
  return [
    ...duplicatePhaseIdIssues(graph),
    ...danglingTransitionIssues(graph),
    ...noOutgoingTransitionIssues(graph),
    ...allConditionalTransitionIssues(graph),
  ]
}
