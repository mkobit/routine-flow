import type { Phase } from '../phase/phase'
import type { PhaseInstance, Session } from '../session/session'
import type { FileMutation } from '../mutation/file-mutation'
import type { ApplyMutationsResult } from '../mutation/apply-mutations'
import type { HookEvent, HookName } from './hook-reference'

export type { HookEvent }

/**
 * What a hook is given to work with. Kept minimal for now — the exact
 * params/args shape hooks receive will get constrained once the execution
 * model is closer to real use, not speculatively designed here.
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
}

/**
 * A hook is pure(ish): given context, it returns the FileMutation intents it
 * wants applied, rather than mutating the vault directly. Keeps hooks
 * testable and gives the engine a single choke point for applying them.
 * Always Promise-returning — some hooks (e.g. write-back) must await an
 * interactive prompt before they know what, if anything, to return.
 */
export type Hook = (context: HookContext) => Promise<readonly FileMutation[]>

/** Resolves a hook by name. Never eval's from settings/frontmatter. */
export interface HookRegistry {
  readonly resolve: (name: HookName) => Hook | undefined
}

/**
 * Outcome of invoking one resolved hook. 'invocationFailed' covers a hook
 * that threw synchronously or whose returned promise rejected — distinct
 * from 'applied', where the hook ran to completion and its (possibly empty)
 * FileMutation[] went through applyMutations, which has its own independent
 * success/failure outcome. 'applied' carries the hook's raw returned
 * `mutations` alongside `result`, since `ApplyMutationsResult`'s success case
 * is bare `{ success: true }` — recovering "which mutations actually wrote"
 * needs the original list, not just whether the whole batch succeeded.
 */
export type HookInvocationOutcome
  = | { readonly stage: 'applied', readonly mutations: readonly FileMutation[], readonly result: ApplyMutationsResult }
    | { readonly stage: 'invocationFailed', readonly cause: unknown }
