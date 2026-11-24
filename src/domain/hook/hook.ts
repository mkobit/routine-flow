import type { Phase } from '../phase/phase'
import type { PhaseInstance, Session } from '../session/session'
import type { FileMutation } from '../mutation/file-mutation'
import type { ApplyMutationsResult } from '../mutation/apply-mutations'
import type { HookEvent, HookName } from './hook-reference'

export type { HookEvent }

/**
 * What a hook is given to work with.
 */
export interface HookContext {
  readonly phase: Phase
  readonly instance: PhaseInstance
  readonly session: Session
  /**
   * The engine's current active file path. Distinct from `instance.itemsTouched`'s tail (a richer
   * ItemTouch snapshot) -- this is just the raw path, unconditionally present whenever one is set.
   */
  readonly activeFilePath: string | null
  /** The firing HookReference's own `params`, verbatim -- how a Phase/TransitionCondition config parameterizes the named hook it fires. */
  readonly params: Readonly<Record<string, unknown>>
}

/**
 * A hook returns `FileMutation` intents rather than mutating the vault directly.
 * Always Promise-returning so interactive hooks (e.g. write-back) can await prompts.
 */
export type Hook = (context: HookContext) => Promise<readonly FileMutation[]>

/** Resolves a hook by name. Never eval's from settings/frontmatter. */
export interface HookRegistry {
  readonly resolve: (name: HookName) => Hook | undefined
}

/**
 * Outcome of invoking one resolved hook: `'invocationFailed'` if the hook threw or
 * rejected; `'applied'` if it resolved and its mutations ran through `applyMutations`.
 * `'applied'` retains `mutations` because `ApplyMutationsResult` does not echo them.
 */
export type HookInvocationOutcome =
  | { readonly stage: 'applied', readonly mutations: readonly FileMutation[], readonly result: ApplyMutationsResult }
  | { readonly stage: 'invocationFailed', readonly cause: unknown }
