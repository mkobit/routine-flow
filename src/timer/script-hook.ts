import { z } from 'zod'
import type { FrontmatterReader } from '../domain/mutation/frontmatter-reader'
import type { Hook, HookContext } from '../domain/hook/hook'
import { FileMutationSchema } from '../domain/mutation/file-mutation'

/**
 * HookContext plus the active file's pre-resolved, read-only frontmatter --
 * the one enrichment a script-backed Hook gets beyond what every Hook
 * already receives. Scoped to this module rather than widening the shared
 * HookContext type: no other Hook (e.g. write-back) needs it, and every
 * existing Hook already resolves what it needs itself via its own injected
 * deps -- see design.md's script-hook-execution requirements.
 */
export interface ScriptHookContext extends HookContext {
  readonly activeFileFrontmatter: Readonly<Record<string, unknown>> | null
}

/** The subset of the timeout timer API createScriptHook needs, swappable in tests without touching the real `window` -- mirrors TickerTimers (ticker.ts). */
export interface ScriptHookTimers {
  readonly setTimeout: (callback: () => void, delayMs: number) => number
  readonly clearTimeout: (id: number) => void
}

const windowTimers: ScriptHookTimers = {
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: id => window.clearTimeout(id),
}

export interface ScriptHookDeps {
  readonly frontmatterReader: FrontmatterReader
  readonly timers?: ScriptHookTimers
  /**
   * Milliseconds before an invocation still awaiting its script's promise is
   * treated as failed. Does not stop the script itself -- there is no
   * in-process mechanism to preempt a script's execution once started
   * (no Worker, no isolation; see design.md's 2026-07-28 Decisions). A
   * timed-out script keeps running with the same host access it always had;
   * "treated as failed" describes what this Hook resolves with, not a
   * guarantee that the script has stopped.
   */
  readonly timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 5000

/**
 * Races a promise against a timeout without stopping the promise itself (see
 * ScriptHookDeps.timeoutMs). Always attaches a no-op `.catch()` to the
 * original promise before returning/throwing, so a rejection that arrives
 * after the timeout already won doesn't surface as an unhandled-rejection
 * warning -- harmless to attach on the normal (non-timeout) path too, since a
 * settled promise's extra `.catch()` never fires.
 */
async function raceWithTimeout<T>(promise: Promise<T>, timers: ScriptHookTimers, timeoutMs: number): Promise<T> {
  let timeoutId: number | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = timers.setTimeout(() => {
      reject(new Error(`Script hook invocation timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  }
  finally {
    if (timeoutId !== undefined) {
      timers.clearTimeout(timeoutId)
    }
    void promise.catch(() => {})
  }
}

/**
 * Compiles a script source string into an invocable function. `new
 * Function`, executed in-process on the main thread, is the deliberate
 * mechanism this design settled on (see design.md's 2026-07-28 Decisions) --
 * no runtime sandbox, no Node/host isolation. The bind-time confirmation
 * gate (script-hook-source) is the only trust boundary; a script bound and
 * confirmed there has the same host access as any other in-process code.
 */
function compileScript(source: string): (context: ScriptHookContext) => Promise<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- vault-authored scripts are this feature, gated by the bind-time confirmation (script-hook-source), not a code-injection bug; see design.md. obsidianmd/rule-custom-message (covers no-new-func) is off for this file only -- see eslint.config.mts.
  const scriptFn = new Function('context', `return (async () => {\n${source}\n})();`)
  return scriptFn.bind(undefined)
}

/**
 * Builds the Hook adapter for one script binding: enriches HookContext with
 * the active file's current frontmatter, invokes the compiled script under a
 * soft timeout, and validates its resolved value against FileMutation[] --
 * see specs/script-hook-execution/spec.md. This is what a
 * MutableScriptHookRegistry entry resolves to.
 */
export function createScriptHook(scriptSource: string, deps: ScriptHookDeps): Hook {
  const invoke = compileScript(scriptSource)
  const timers = deps.timers ?? windowTimers
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS
  return async (context) => {
    const activeFileFrontmatter = context.activeFilePath === null ? null : deps.frontmatterReader.readAll(context.activeFilePath)
    const enriched: ScriptHookContext = { ...context, activeFileFrontmatter }
    const result = await raceWithTimeout(invoke(enriched), timers, timeoutMs)
    return z.array(FileMutationSchema).parse(result)
  }
}
