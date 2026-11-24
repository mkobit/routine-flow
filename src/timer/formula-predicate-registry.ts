import type { Predicate, PredicateName, PredicateRegistry } from '../domain/hook/predicate'
import { compileFormula } from '../domain/hook/formula/evaluator'

/** One settings-stored name+formula pair, as authored in the settings tab. */
export interface FormulaPredicateSetting {
  readonly name: PredicateName
  readonly formula: string
}

/**
 * Widens PredicateRegistry with `setFormulas` so settings-driven formula predicates
 * can be rebuilt wholesale at runtime when settings change.
 */
export interface MutableFormulaPredicateRegistry extends PredicateRegistry {
  readonly setFormulas: (formulas: readonly FormulaPredicateSetting[]) => void
}

/** Class wrapper so `ignoreClasses` covers internal Map updates. */
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
