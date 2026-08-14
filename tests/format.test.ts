import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { PhaseSchema } from '../src/domain/phase/phase'
import { formatCountdown, formatPhaseHeader } from '../src/timer/format'

const phase = PhaseSchema.parse({
  id: 'focus',
  label: 'Focus',
  kind: 'focus',
  duration: Temporal.Duration.from({ seconds: 10 }),
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  logTarget: { kind: 'activeItem' },
  onEnter: null,
  onComplete: null,
  onSkip: null,
  onExit: null,
})

describe('formatPhaseHeader', () => {
  test('formats remaining time as mm:ss alongside label and status', () => {
    const remaining = Temporal.Duration.from({ minutes: 24, seconds: 59 })
    expect(formatPhaseHeader(phase, remaining, 'running')).toBe('Focus: 24:59 (running)')
  })

  test('zero-pads seconds and minutes under 10', () => {
    const remaining = Temporal.Duration.from({ seconds: 9 })
    expect(formatPhaseHeader(phase, remaining, 'paused')).toBe('Focus: 00:09 (paused)')
  })

  test('omits the time segment for a duration-less phase', () => {
    expect(formatPhaseHeader(phase, null, 'running')).toBe('Focus (running)')
  })
})

describe('formatCountdown', () => {
  test('formats remaining time as mm:ss', () => {
    expect(formatCountdown(Temporal.Duration.from({ minutes: 24, seconds: 59 }))).toBe('24:59')
  })

  test('formats remaining time as hh:mm:ss when requested', () => {
    expect(formatCountdown(Temporal.Duration.from({ hours: 1, minutes: 24, seconds: 59 }), 'hh:mm:ss')).toBe('01:24:59')
  })

  test('formats remaining time as ss.s when requested', () => {
    expect(formatCountdown(Temporal.Duration.from({ seconds: 15, milliseconds: 500 }), 'ss.s')).toBe('15.5s')
  })

  test('formats remaining time as ms when requested', () => {
    expect(formatCountdown(Temporal.Duration.from({ milliseconds: 450 }), 'ms')).toBe('450ms')
  })

  test('zero-pads seconds and minutes under 10', () => {
    expect(formatCountdown(Temporal.Duration.from({ seconds: 9 }))).toBe('00:09')
  })

  test('returns null for a duration-less phase', () => {
    expect(formatCountdown(null)).toBeNull()
  })
})
