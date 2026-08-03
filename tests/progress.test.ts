import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { computeProgressFraction } from '../src/timer/progress'

const duration = Temporal.Duration.from({ minutes: 25 })

describe('computeProgressFraction', () => {
  test('is 0 the instant a phase starts (remaining === duration)', () => {
    expect(computeProgressFraction(duration, Temporal.Duration.from({ minutes: 25 }))).toBe(0)
  })

  test('is 1 once a phase completes (remaining === zero)', () => {
    expect(computeProgressFraction(duration, Temporal.Duration.from({ seconds: 0 }))).toBe(1)
  })

  test('is the elapsed proportion partway through', () => {
    expect(computeProgressFraction(duration, Temporal.Duration.from({ minutes: 20 }))).toBeCloseTo(0.2, 10)
    expect(computeProgressFraction(duration, Temporal.Duration.from({ minutes: 5 }))).toBeCloseTo(0.8, 10)
  })

  test('clamps to 1 when remaining is negative (should not happen)', () => {
    expect(computeProgressFraction(duration, Temporal.Duration.from({ seconds: -30 }))).toBe(1)
  })

  test('clamps to 0 when remaining exceeds duration (should not happen)', () => {
    expect(computeProgressFraction(duration, Temporal.Duration.from({ minutes: 40 }))).toBe(0)
  })

  test('is 1 for a zero-length duration rather than dividing by zero', () => {
    expect(computeProgressFraction(Temporal.Duration.from({ seconds: 0 }), Temporal.Duration.from({ seconds: 0 }))).toBe(1)
  })
})
