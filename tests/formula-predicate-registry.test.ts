import { test, expect, describe } from 'bun:test'
import { createFormulaPredicateRegistry } from '../src/timer/formula-predicate-registry'
import { PredicateNameSchema } from '../src/domain/hook/predicate'
import { PhaseIdSchema } from '../src/domain/phase/phase'

const focusId = PhaseIdSchema.parse('focus')

describe('MutableFormulaPredicateRegistry', () => {
  test('resolves a name registered via setFormulas to a working predicate', () => {
    const registry = createFormulaPredicateRegistry()
    registry.setFormulas([{ name: PredicateNameSchema.parse('focused-enough'), formula: 'visitCounts.focus >= 4' }])

    const predicate = registry.resolve(PredicateNameSchema.parse('focused-enough'))

    expect(predicate).toBeDefined()
    expect(predicate?.(focusId, { [focusId]: 4 })).toBe(true)
    expect(predicate?.(focusId, { [focusId]: 1 })).toBe(false)
  })

  test('an unregistered name resolves to undefined', () => {
    const registry = createFormulaPredicateRegistry()

    expect(registry.resolve(PredicateNameSchema.parse('missing'))).toBeUndefined()
  })

  test('setFormulas replaces the whole set — a name dropped from the list stops resolving', () => {
    const registry = createFormulaPredicateRegistry()
    const name = PredicateNameSchema.parse('temp')
    registry.setFormulas([{ name, formula: 'true' }])
    expect(registry.resolve(name)).toBeDefined()

    registry.setFormulas([])

    expect(registry.resolve(name)).toBeUndefined()
  })

  test('an unparseable formula in the list is silently skipped rather than registered', () => {
    const registry = createFormulaPredicateRegistry()
    const name = PredicateNameSchema.parse('broken')
    registry.setFormulas([{ name, formula: 'visitCounts.focus >=' }])

    expect(registry.resolve(name)).toBeUndefined()
  })
})
