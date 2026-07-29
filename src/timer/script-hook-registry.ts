import type { Hook, HookRegistry } from '../domain/hook/hook'
import type { HookName } from '../domain/hook/hook-reference'
import { createScriptHook } from './script-hook'
import type { ScriptHookDeps } from './script-hook'

/**
 * One settings-stored name+script pair, as authored and confirmed in the
 * settings tab. `scriptSource` is the snapshot reviewed and confirmed at
 * bind time (script-hook-source's bind-time confirmation gate) -- a later
 * on-disk edit to `scriptPath`'s file has no effect on what actually runs
 * until the binding is removed and re-added. Re-confirming in place when a
 * bound file's content changes is a known follow-up (see design.md's Open
 * Questions), not implemented here.
 */
export interface ScriptHookBindingSetting {
  readonly name: HookName
  readonly scriptPath: string
  readonly scriptSource: string
}

/**
 * Widens HookRegistry with setBindings -- unlike the plugin's static
 * write-back Hook, script-hook bindings are settings-driven and can change at
 * runtime (add/remove in the settings tab), so this registry rebuilds its
 * resolvable set wholesale from the current settings list rather than being
 * populated once at plugin load (same "populated once" contrast as
 * MutableTaskSourceRegistry and MutableFormulaPredicateRegistry).
 */
export interface MutableScriptHookRegistry extends HookRegistry {
  readonly setBindings: (bindings: readonly ScriptHookBindingSetting[]) => void
}

/** A class, not a closure-returning factory -- same rationale as FormulaPredicateRegistryImpl (eslint.config.mts's src/timer/** ignoreClasses exemption covers mutation inside a class, not a closure over a Map). */
class ScriptHookRegistryImpl implements MutableScriptHookRegistry {
  private hooks = new Map<HookName, Hook>()

  constructor(private readonly deps: ScriptHookDeps) {}

  resolve = (name: HookName): Hook | undefined => this.hooks.get(name)

  setBindings = (bindings: readonly ScriptHookBindingSetting[]): void => {
    const next = new Map<HookName, Hook>()
    for (const binding of bindings) {
      next.set(binding.name, createScriptHook(binding.scriptSource, this.deps))
    }
    this.hooks = next
  }
}

export function createScriptHookRegistry(deps: ScriptHookDeps): MutableScriptHookRegistry {
  return new ScriptHookRegistryImpl(deps)
}
