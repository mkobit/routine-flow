import type { Predicate, PredicateName, PredicateRegistry } from '../domain/hook/predicate'
import { compileFormula } from '../domain/hook/formula/evaluator'

/** One settings-stored name+formula pair, as authored in the settings tab. */
export interface FormulaPredicateSetting {
  readonly name: PredicateName
  readonly formula: string
}

/**
 * Widens PredicateRegistry with setFormulas — unlike the plugin's static
 * write-back Hook, formula-authored predicates are settings-driven and can
 * change at runtime (add/edit/remove in the settings tab), so this registry
 * rebuilds its resolvable set wholesale from the current settings list
 * rather than being populated once at plugin load (see design.md's Migration
 * Plan and MutableTaskSourceRegistry's identical "populated once" contrast).
 */
export interface MutableFormulaPredicateRegistry extends PredicateRegistry {
  readonly setFormulas: (formulas: readonly FormulaPredicateSetting[]) => void
}

/** A class, not a closure-returning factory — same rationale as TaskSourceRegistryImpl (eslint.config.mts's src/timer/** ignoreClasses exemption covers mutation inside a class, not a closure over a Map). */
class FormulaPredicateRegistryImpl implements MutableFormulaPredicateRegistry {
  private predicates = new Map<PredicateName, Predicate>()

  resolve = (name: PredicateName): Predicate | undefined => this.predicates.get(name)

  setFormulas = (formulas: readonly FormulaPredicateSetting[]): void => {
    const next = new Map<PredicateName, Predicate>()
    for (const { name, formula } of formulas) {
      const compiled = compileFormula(formula)
      if (compiled.ok) {
        next.set(name, compiled.predicate)
      }
    }
    this.predicates = next
  }
}

export function createFormulaPredicateRegistry(): MutableFormulaPredicateRegistry {
  return new FormulaPredicateRegistryImpl()
}
