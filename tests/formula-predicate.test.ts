import { test, expect, describe } from 'bun:test'
import { compileFormula } from '../src/domain/hook/formula/evaluator'
import { PhaseIdSchema } from '../src/domain/phase/phase'

const focusId = PhaseIdSchema.parse('focus')
const breakId = PhaseIdSchema.parse('break')

describe('compileFormula parsing', () => {
  test('accepts a comparison-and-conditional formula', () => {
    const compiled = compileFormula('if(visitCounts.focus >= 4, true, false)')
    expect(compiled.ok).toBe(true)
  })

  test('accepts a bare comparison', () => {
    const compiled = compileFormula('visitCounts.focus >= 4')
    expect(compiled.ok).toBe(true)
  })

  test('accepts and/or/not boolean operators', () => {
    expect(compileFormula('visitCounts.focus >= 4 and visitCounts.break < 2').ok).toBe(true)
    expect(compileFormula('visitCounts.focus >= 4 or visitCounts.break < 2').ok).toBe(true)
    expect(compileFormula('not visitCounts.focus >= 4').ok).toBe(true)
  })

  test('accepts string comparisons against fromPhaseId', () => {
    expect(compileFormula('fromPhaseId == "focus"').ok).toBe(true)
  })

  test('accepts parenthesized sub-expressions', () => {
    expect(compileFormula('(visitCounts.focus >= 4) and (fromPhaseId == "focus")').ok).toBe(true)
  })

  test('accepts tracker.<property> numeric and string comparisons', () => {
    expect(compileFormula('tracker.stars >= 15').ok).toBe(true)
    expect(compileFormula('tracker.tier == "gold"').ok).toBe(true)
    expect(compileFormula('tracker.stars >= 15 and visitCounts.focus >= 2').ok).toBe(true)
  })

  test('rejects a variable-assignment construct', () => {
    const compiled = compileFormula('x = 4')
    expect(compiled.ok).toBe(false)
  })

  test('rejects a function-definition-shaped construct', () => {
    const compiled = compileFormula('function foo() { return true }')
    expect(compiled.ok).toBe(false)
  })

  test('rejects an unparseable/garbage formula', () => {
    const compiled = compileFormula('visitCounts.focus >=')
    expect(compiled.ok).toBe(false)
  })

  test('rejects incomplete tracker member access', () => {
    expect(compileFormula('tracker >= 15').ok).toBe(false)
    expect(compileFormula('tracker. >= 15').ok).toBe(false)
  })

  test('rejects trailing tokens after a complete expression', () => {
    const compiled = compileFormula('true true')
    expect(compiled.ok).toBe(false)
  })

  test('rejects a formula that does not evaluate to boolean', () => {
    expect(compileFormula('visitCounts.focus').ok).toBe(false)
    expect(compileFormula('tracker.stars').ok).toBe(false)
  })

  test('rejects mismatched-type comparisons', () => {
    const compiled = compileFormula('visitCounts.focus == "4"')
    expect(compiled.ok).toBe(false)
  })

  test.each([
    'visitCounts.constructor',
    'visitCounts.__proto__',
    'visitCounts.prototype',
    'visitCounts.hasOwnProperty',
    'tracker.constructor',
    'tracker.__proto__',
    'tracker.prototype',
    'tracker.hasOwnProperty',
    'tracker.toString',
    'tracker.valueOf',
  ])('rejects prototype-chain reference %s', (expr) => {
    const compiled = compileFormula(`${expr} == 0`)
    expect(compiled.ok).toBe(false)
  })

  test('rejects an unknown identifier outside the whitelist', () => {
    const compiled = compileFormula('window == "focus"')
    expect(compiled.ok).toBe(false)
  })
})

describe('compileFormula evaluation', () => {
  test('if(cond, then, else) evaluates the correct branch', () => {
    const compiled = compileFormula('if(visitCounts.focus >= 4, true, false)')
    if (!compiled.ok) {
      throw new Error('expected formula to compile')
    }
    expect(compiled.predicate({ fromPhaseId: focusId, visitCounts: { [focusId]: 4 } })).toBe(true)
    expect(compiled.predicate({ fromPhaseId: focusId, visitCounts: { [focusId]: 3 } })).toBe(false)
  })

  test('missing visitCounts keys default to 0', () => {
    const compiled = compileFormula('visitCounts.focus == 0')
    if (!compiled.ok) {
      throw new Error('expected formula to compile')
    }
    expect(compiled.predicate({ fromPhaseId: focusId, visitCounts: {} })).toBe(true)
  })

  test('and/or/not evaluate correctly', () => {
    const and = compileFormula('visitCounts.focus >= 2 and visitCounts.break >= 1')
    const or = compileFormula('visitCounts.focus >= 2 or visitCounts.break >= 1')
    const not = compileFormula('not (visitCounts.focus >= 2)')
    if (!and.ok || !or.ok || !not.ok) {
      throw new Error('expected formulas to compile')
    }
    const counts = { [focusId]: 2, [breakId]: 0 }
    expect(and.predicate({ fromPhaseId: focusId, visitCounts: counts })).toBe(false)
    expect(or.predicate({ fromPhaseId: focusId, visitCounts: counts })).toBe(true)
    expect(not.predicate({ fromPhaseId: focusId, visitCounts: counts })).toBe(false)
  })

  test('fromPhaseId compares as a string', () => {
    const compiled = compileFormula('fromPhaseId == "focus"')
    if (!compiled.ok) {
      throw new Error('expected formula to compile')
    }
    expect(compiled.predicate({ fromPhaseId: focusId, visitCounts: {} })).toBe(true)
    expect(compiled.predicate({ fromPhaseId: breakId, visitCounts: {} })).toBe(false)
  })

  test('tracker.stars >= 15 evaluates synchronously against trackerFrontmatter', () => {
    const compiled = compileFormula('tracker.stars >= 15')
    if (!compiled.ok) {
      throw new Error('expected formula to compile')
    }
    expect(compiled.predicate({
      fromPhaseId: focusId,
      visitCounts: {},
      trackerFrontmatter: { stars: 15 },
    })).toBe(true)
    expect(compiled.predicate({
      fromPhaseId: focusId,
      visitCounts: {},
      trackerFrontmatter: { stars: 20 },
    })).toBe(true)
    expect(compiled.predicate({
      fromPhaseId: focusId,
      visitCounts: {},
      trackerFrontmatter: { stars: 14 },
    })).toBe(false)
  })

  test('missing trackerFrontmatter or undefined tracker property defaults safely to 0', () => {
    const threshold = compileFormula('tracker.stars >= 15')
    const zeroCheck = compileFormula('tracker.stars == 0')
    if (!threshold.ok || !zeroCheck.ok) {
      throw new Error('expected formulas to compile')
    }
    expect(threshold.predicate({ fromPhaseId: focusId, visitCounts: {} })).toBe(false)
    expect(threshold.predicate({ fromPhaseId: focusId, visitCounts: {}, trackerFrontmatter: {} })).toBe(false)
    expect(zeroCheck.predicate({ fromPhaseId: focusId, visitCounts: {} })).toBe(true)
    expect(zeroCheck.predicate({ fromPhaseId: focusId, visitCounts: {}, trackerFrontmatter: {} })).toBe(true)
  })

  test('tracker.<property> supports string comparisons and fails closed on mismatched runtime types', () => {
    const stringEq = compileFormula('tracker.tier == "gold"')
    const numGe = compileFormula('tracker.stars >= 15')
    if (!stringEq.ok || !numGe.ok) {
      throw new Error('expected formulas to compile')
    }
    expect(stringEq.predicate({
      fromPhaseId: focusId,
      visitCounts: {},
      trackerFrontmatter: { tier: 'gold' },
    })).toBe(true)
    expect(stringEq.predicate({
      fromPhaseId: focusId,
      visitCounts: {},
      trackerFrontmatter: { tier: 'silver' },
    })).toBe(false)
    expect(stringEq.predicate({
      fromPhaseId: focusId,
      visitCounts: {},
      trackerFrontmatter: {},
    })).toBe(false)
    expect(numGe.predicate({
      fromPhaseId: focusId,
      visitCounts: {},
      trackerFrontmatter: { stars: 'fifteen' },
    })).toBe(false)
    expect(numGe.predicate({
      fromPhaseId: focusId,
      visitCounts: {},
      trackerFrontmatter: { stars: null },
    })).toBe(false)
  })

  test('tracker.<property> ignores inherited prototype properties at evaluation time', () => {
    const compiled = compileFormula('tracker.stars >= 15')
    if (!compiled.ok) {
      throw new Error('expected formula to compile')
    }
    const inherited: Readonly<Record<string, unknown>> = Object.create({ stars: 20 })
    expect(compiled.predicate({
      fromPhaseId: focusId,
      visitCounts: {},
      trackerFrontmatter: inherited,
    })).toBe(false)
  })
})
