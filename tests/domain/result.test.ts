import { test, expect, describe } from 'bun:test'
import { map, andThen } from '../../src/domain/result'
import type { Result } from '../../src/domain/result'

describe('map', () => {
  test('transforms a success value', () => {
    const result: Result<number, string> = { success: true, value: 2 }

    expect(map(result, n => n * 10)).toEqual({ success: true, value: 20 })
  })

  test('passes a failure through untouched, without calling fn', () => {
    const result: Result<number, string> = { success: false, error: 'boom' }
    const fn = (n: number) => n * 10

    expect(map(result, fn)).toEqual({ success: false, error: 'boom' })
  })
})

describe('andThen', () => {
  const half = (n: number): Result<number, string> =>
    n % 2 === 0 ? { success: true, value: n / 2 } : { success: false, error: `${n} is odd` }

  test('chains into another Result-returning step on success', () => {
    const result: Result<number, string> = { success: true, value: 8 }

    expect(andThen(result, half)).toEqual({ success: true, value: 4 })
  })

  test('short-circuits a failing step, without calling fn', () => {
    const result: Result<number, string> = { success: true, value: 7 }

    expect(andThen(result, half)).toEqual({ success: false, error: '7 is odd' })
  })

  test('passes an already-failed result through untouched, without calling fn', () => {
    const result: Result<number, string> = { success: false, error: 'boom' }

    expect(andThen(result, half)).toEqual({ success: false, error: 'boom' })
  })
})
