import { test, expect, describe } from 'bun:test'
import { coerceWriteBackValue } from '../../src/domain/mutation/write-back-prompt'

describe('coerceWriteBackValue', () => {
  test('parses a plain integer string as a number', () => {
    expect(coerceWriteBackValue('4')).toBe(4)
  })

  test('parses a decimal string as a number', () => {
    expect(coerceWriteBackValue('4.5')).toBe(4.5)
  })

  test('trims whitespace before parsing', () => {
    expect(coerceWriteBackValue('  7  ')).toBe(7)
  })

  test('keeps non-numeric text as a string', () => {
    expect(coerceWriteBackValue('in progress')).toBe('in progress')
  })

  test('keeps an empty string as a string, not 0', () => {
    expect(coerceWriteBackValue('')).toBe('')
  })

  test('keeps whitespace-only text as a string', () => {
    expect(coerceWriteBackValue('   ')).toBe('   ')
  })

  test('keeps non-finite-looking text (Infinity) as a string', () => {
    expect(coerceWriteBackValue('Infinity')).toBe('Infinity')
  })
})
