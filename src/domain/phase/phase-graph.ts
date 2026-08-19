import { z } from 'zod'
import { PhaseIdSchema, PhaseNodeSchema } from './phase'
import type { PhaseNode, PhaseId } from './phase'

/**
 * Identifier for a PhaseGraph. Branded so it can't be mixed up with a PhaseId.
 */
export const PhaseGraphIdSchema = z.string().min(1).brand<'PhaseGraphId'>()
export type PhaseGraphId = z.infer<typeof PhaseGraphIdSchema>

function toRecord(val: unknown): Record<string, unknown> | null {
  return typeof val === 'object' && val !== null ? Object(val) : null
}

/**
 * Pure, synchronous routing guard on a transition edge.
 */
export const EdgeGuardSchema = z.preprocess((val) => {
  const raw = toRecord(val)
  return raw
    ? {
        ...raw,
        count: raw.count ?? raw.n,
        predicateName: raw.predicateName ?? raw.predicate,
      }
    : val
}, z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('always') }).readonly(),
  z.object({ kind: z.literal('everyNth'), count: z.number().int().positive() }).readonly(),
  z.object({ kind: z.literal('queueExhausted') }).readonly(),
  z.object({ kind: z.literal('custom'), predicateName: z.string(), params: z.record(z.string(), z.unknown()).optional() }).readonly(),
])).readonly()

export type EdgeGuard = z.infer<typeof EdgeGuardSchema>
export const TransitionConditionSchema = EdgeGuardSchema
export type TransitionCondition = EdgeGuard

/** An edge in a PhaseGraph: from one phase to another, guarded by an EdgeGuard. */
export const TransitionEdgeSchema = z.preprocess((val) => {
  const raw = toRecord(val)
  const from = raw ? (raw.from ?? raw.fromPhaseId) : undefined
  const to = raw ? (raw.to ?? raw.toPhaseId) : undefined
  const guard = raw ? (raw.guard ?? raw.condition ?? { kind: 'always' }) : undefined
  return raw
    ? {
        ...raw,
        from,
        to,
        guard,
        fromPhaseId: from,
        toPhaseId: to,
        condition: guard,
      }
    : val
}, z.object({
  from: PhaseIdSchema,
  to: PhaseIdSchema,
  guard: EdgeGuardSchema.default({ kind: 'always' }),
  fromPhaseId: PhaseIdSchema,
  toPhaseId: PhaseIdSchema,
  condition: EdgeGuardSchema.default({ kind: 'always' }),
}).readonly()).readonly()

export type TransitionEdge = z.infer<typeof TransitionEdgeSchema>
export const PhaseTransitionSchema = TransitionEdgeSchema
export type PhaseTransition = TransitionEdge

/**
 * A named graph of PhaseNodes plus the transition edges between them.
 */
export const PhaseGraphSchema = z.object({
  id: PhaseGraphIdSchema,
  name: z.string().min(1),
  phases: z.array(PhaseNodeSchema).min(1).readonly(),
  transitions: z.array(TransitionEdgeSchema).readonly(),
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
  return duplicates(graph.phases.map((phase: PhaseNode) => phase.id))
    .map(id => ({ message: `Phase id "${id}" is declared more than once.` }))
}

function danglingTransitionIssues(graph: PhaseGraph): readonly PhaseGraphIntegrityIssue[] {
  const knownIds = graph.phases.map((phase: PhaseNode) => phase.id)
  const referencedIds = graph.transitions.flatMap(transition => [transition.from, transition.to])
  return distinct(referencedIds.filter(id => !knownIds.includes(id)))
    .map(id => ({ message: `A transition references phase id "${id}", which isn't declared in this graph's phases.` }))
}

/**
 * Referential-integrity checks: duplicate phase ids, transitions referencing a phase id absent from `phases`.
 * Terminal nodes (phases with zero outgoing edges) are explicitly allowed and return null on next-phase resolution.
 */
export function checkPhaseGraphIntegrity(graph: PhaseGraph): readonly PhaseGraphIntegrityIssue[] {
  return [
    ...duplicatePhaseIdIssues(graph),
    ...danglingTransitionIssues(graph),
  ]
}
