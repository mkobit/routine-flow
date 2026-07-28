import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { PositiveDurationSchema, NonNegativeDurationSchema } from '../src/domain/duration'
import { LogEntrySchema, nextLogEntry } from '../src/domain/mutation/log-entry'

describe('PositiveDurationSchema', () => {
  test('accepts a positive duration', () => {
    const result = PositiveDurationSchema.safeParse(Temporal.Duration.from({ seconds: 1 }))
    expect(result.success).toBe(true)
  })

  test('rejects a zero duration', () => {
    const result = PositiveDurationSchema.safeParse(Temporal.Duration.from({ seconds: 0 }))
    expect(result.success).toBe(false)
  })
})

describe('NonNegativeDurationSchema', () => {
  test('accepts a zero duration', () => {
    const result = NonNegativeDurationSchema.safeParse(Temporal.Duration.from({ seconds: 0 }))
    expect(result.success).toBe(true)
  })

  test('rejects a negative duration', () => {
    const result = NonNegativeDurationSchema.safeParse(Temporal.Duration.from({ seconds: -1 }))
    expect(result.success).toBe(false)
  })
})

describe('LogEntrySchema', () => {
  test('parses a valid entry', () => {
    const entry = LogEntrySchema.parse({
      property: 'sessions',
      value: 1,
      recordedAt: Temporal.Now.instant(),
    })
    expect(entry.property).toBe('sessions')
    expect(entry.value).toBe(1)
  })

  test('rejects an empty property name', () => {
    const result = LogEntrySchema.safeParse({
      property: '',
      value: 1,
      recordedAt: Temporal.Now.instant(),
    })
    expect(result.success).toBe(false)
  })
})

describe('nextLogEntry', () => {
  const now = Temporal.Now.instant()

  test('increments a numeric current value by 1', () => {
    const entry = nextLogEntry(3, 'sessions', now)
    expect(entry).toEqual({ property: 'sessions', value: 4, recordedAt: now })
  })

  test('yields 1 for an undefined current value', () => {
    const entry = nextLogEntry(undefined, 'sessions', now)
    expect(entry.value).toBe(1)
  })

  test('yields 1 for a non-numeric current value', () => {
    const entry = nextLogEntry('not-a-number', 'sessions', now)
    expect(entry.value).toBe(1)
  })

  test('yields 1 for a NaN current value', () => {
    const entry = nextLogEntry(Number.NaN, 'sessions', now)
    expect(entry.value).toBe(1)
  })

  test('yields 1 for an Infinity current value', () => {
    const entry = nextLogEntry(Number.POSITIVE_INFINITY, 'sessions', now)
    expect(entry.value).toBe(1)
  })

  test('passes property and recordedAt through unchanged', () => {
    const entry = nextLogEntry(5, 'streak', now)
    expect(entry.property).toBe('streak')
    expect(entry.recordedAt).toBe(now)
  })
})
