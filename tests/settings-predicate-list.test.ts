import { test, expect, describe } from 'bun:test'
import { formulaPredicatesToListItems } from '../src/settings-predicate-list'
import { PredicateNameSchema } from '../src/domain/hook/predicate'

describe('formulaPredicatesToListItems', () => {
  test('maps each predicate to a display-only name/desc item, in order', () => {
    const items = formulaPredicatesToListItems([
      { name: PredicateNameSchema.parse('focused-enough'), formula: 'visitCounts.focus >= 4' },
      { name: PredicateNameSchema.parse('always'), formula: 'true' },
    ])

    expect(items).toEqual([
      { name: 'focused-enough', desc: 'visitCounts.focus >= 4' },
      { name: 'always', desc: 'true' },
    ])
  })

  test('an empty predicate list maps to an empty item list', () => {
    expect(formulaPredicatesToListItems([])).toEqual([])
  })
})
