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
 * Pre-resolved synchronous snapshot passed to a transition `Predicate`.
 * `trackerFrontmatter` is pre-read synchronously by `EngineStore` from
 * `FrontmatterReader` / `metadataCache` prior to `engineReducer` dispatch so
 * predicate evaluation inside `engineReducer` remains pure and synchronous.
 */
export interface PredicateContext {
  readonly fromPhaseId: PhaseId
  readonly visitCounts: Readonly<Record<PhaseId, number>>
  readonly trackerFrontmatter?: Readonly<Record<string, unknown>>
}

/**
 * A transition predicate: given a `PredicateContext` (the phase a
 * TransitionCondition is being evaluated from, the graph's visit counters,
 * and optional pre-read tracker frontmatter), decides whether a 'custom'
 * condition is satisfied. Deliberately narrower than HookContext — this runs
 * synchronously inside the pure engineReducer (it decides
 * EngineState.currentPhaseId itself), before any next-state HookContext
 * could exist to hand it.
 *
 * Purity contract: Predicates are invoked synchronously inside `engineReducer`
 * and MUST be pure, deterministic, and free of side-effects or I/O.
 */
export type Predicate = (context: PredicateContext) => boolean

/** Resolves a predicate by name. Never eval's from settings/frontmatter. */
export interface PredicateRegistry {
  readonly resolve: (name: PredicateName) => Predicate | undefined
}
