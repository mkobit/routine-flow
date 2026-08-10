import { z } from 'zod'
import type { PhaseId } from '../phase/phase'

/**
 * Name of a transition predicate resolved via a PredicateRegistry. Its own
 * brand, distinct from HookName — a predicate isn't resolvable via
 * HookRegistry (different shape: boolean-returning, not FileMutation[]) and
 * shouldn't share a namespace that implies otherwise.
 */
export const PredicateNameSchema = z.string().min(1).brand<'PredicateName'>()
export type PredicateName = z.infer<typeof PredicateNameSchema>

/**
 * A transition predicate: given the phase a TransitionCondition is being
 * evaluated from and the graph's visit counters, decides whether a 'custom'
 * condition is satisfied. Deliberately narrower than HookContext — this runs
 * synchronously inside the pure engineReducer (it decides
 * EngineState.currentPhaseId itself), before any next-state HookContext
 * could exist to hand it. Predicates needing richer/async context (vault
 * content, wall-clock date) aren't expressible here; see flow-gu1.10.
 *
 * Purity contract: Predicates are invoked synchronously inside `engineReducer`
 * and MUST be pure, deterministic, and free of side-effects or I/O.
 */
export type Predicate = (
  fromPhaseId: PhaseId,
  visitCounts: Readonly<Record<PhaseId, number>>,
) => boolean

/** Resolves a predicate by name. Never eval's from settings/frontmatter. */
export interface PredicateRegistry {
  readonly resolve: (name: PredicateName) => Predicate | undefined
}
