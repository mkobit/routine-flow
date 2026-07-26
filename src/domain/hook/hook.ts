import type { Phase } from '../phase/phase'
import type { PhaseInstance, Session } from '../session/session'
import type { FileMutation } from '../mutation/file-mutation'
import type { HookName } from './hook-reference'

/** Which lifecycle moment a hook fires for. */
export type HookEvent = 'onEnter' | 'onComplete' | 'onSkip' | 'onExit'

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
