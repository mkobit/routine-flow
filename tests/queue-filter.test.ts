import { Temporal } from 'temporal-polyfill'
import { test, expect, describe } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import { filterQueueCandidates } from '../src/adapters/obsidian/bases/queue-filter'
import type { QueueFilterCandidate, QueueFilterConfigSource } from '../src/adapters/obsidian/bases/queue-filter'
import { FOCUS_PHASE_KIND, BREAK_PHASE_KIND } from '../src/timer/phase-graph'

function candidate(overrides: Partial<QueueFilterCandidate> & { value?: string | null } = {}): QueueFilterCandidate {
  const { value = null, ...rest } = overrides
  return {
    path: 'tasks/write-report.md',
    basename: 'write-report',
    frontmatter: undefined,
    getValue: () => (value === null ? null : { toString: () => value }),
    ...rest,
  }
}

function config(overrides: Partial<{ propertyId: BasesPropertyId | null, value: string | null }> = {}): QueueFilterConfigSource {
  const { propertyId = null, value = null } = overrides
  return {
    getAsPropertyId: () => propertyId,
    get: (key: string) => (key === 'focusValue' || key === 'breakValue' ? value : undefined),
  }
}

describe('filterQueueCandidates', () => {
  test('an unconfigured View Option falls back to note.type instead of matching every note (flow-djx regression)', () => {
    const candidates = [
      candidate({ path: 'a.md', getValue: propId => (propId === 'note.type' ? { toString: () => 'work' } : null) }),
      candidate({ path: 'b.md', getValue: propId => (propId === 'note.type' ? { toString: () => 'personal' } : null) }),
    ]

    const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates)

    expect(result.map(c => c.path)).toEqual(['a.md'])
  })

  test('uses focusProperty/focusValue for a focus phase', () => {
    const candidates = [
      candidate({ path: 'a.md', getValue: propId => (propId === 'note.status' ? { toString: () => 'active' } : null) }),
      candidate({ path: 'b.md', getValue: propId => (propId === 'note.status' ? { toString: () => 'idle' } : null) }),
    ]
    const cfg = config({ propertyId: 'note.status', value: 'active' })

    const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, cfg, candidates)

    expect(result.map(c => c.path)).toEqual(['a.md'])
  })

  test('uses breakProperty/breakValue for a break phase, defaulting to "break" when unconfigured', () => {
    const candidates = [
      candidate({ path: 'a.md', getValue: propId => (propId === 'note.type' ? { toString: () => 'break' } : null) }),
      candidate({ path: 'b.md', getValue: propId => (propId === 'note.type' ? { toString: () => 'work' } : null) }),
    ]

    const result = filterQueueCandidates({ kind: BREAK_PHASE_KIND }, undefined, candidates)

    expect(result.map(c => c.path)).toEqual(['a.md'])
  })

  test('an empty-string configured value falls back to the kind default rather than matching nothing', () => {
    const candidates = [candidate({ path: 'a.md', getValue: () => ({ toString: () => 'work' }) })]
    const cfg = config({ propertyId: 'note.type', value: '' })

    const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, cfg, candidates)

    expect(result.map(c => c.path)).toEqual(['a.md'])
  })

  test('matches case-insensitively', () => {
    const candidates = [candidate({ path: 'a.md', getValue: () => ({ toString: () => 'WORK' }) })]

    const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates)

    expect(result.map(c => c.path)).toEqual(['a.md'])
  })

  test('a null getValue result is treated as empty string, not a match against a non-empty target', () => {
    const candidates = [candidate({ path: 'a.md', value: null })]

    const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates)

    expect(result).toEqual([])
  })

  test('projects only path/basename/frontmatter into the result, dropping getValue', () => {
    const candidates = [
      candidate({
        path: 'a.md',
        basename: 'a',
        frontmatter: { 'routine-priority': 3 },
        getValue: () => ({ toString: () => 'work' }),
      }),
    ]

    const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates)

    expect(result).toEqual([{ path: 'a.md', basename: 'a', frontmatter: { 'routine-priority': 3 } }])
  })

  describe('temporal due date filtering', () => {
    const EVAL_TIME = Temporal.Instant.from('2026-09-26T12:00:00Z')

    test('excludes notes marked deferred with future routine-due date', () => {
      const candidates = [
        candidate({
          path: 'future.md',
          frontmatter: {
            'routine-status': 'deferred',
            'routine-due': '2026-09-26T13:00:00Z',
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
        candidate({
          path: 'ready.md',
          frontmatter: {
            'routine-status': 'pending',
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
      ]

      const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates, EVAL_TIME)

      expect(result.map(c => c.path)).toEqual(['ready.md'])
    })

    test('excludes notes marked deferred with future next-review date', () => {
      const candidates = [
        candidate({
          path: 'card-1.md',
          frontmatter: {
            'routine-status': 'deferred',
            'next-review': '2026-09-27T00:00:00Z',
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
      ]

      const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates, EVAL_TIME)

      expect(result).toEqual([])
    })

    test('excludes notes marked deferred with future routine-deferred-until date', () => {
      const candidates = [
        candidate({
          path: 'card-1.md',
          frontmatter: {
            'routine-status': 'deferred',
            'routine-deferred-until': '2026-09-26T14:00:00Z',
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
      ]

      const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates, EVAL_TIME)

      expect(result).toEqual([])
    })

    test('excludes notes marked deferred with future dueDate or due date', () => {
      const candidates = [
        candidate({
          path: 'due-date.md',
          frontmatter: {
            'routine-status': 'deferred',
            'dueDate': '2026-09-28',
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
        candidate({
          path: 'due.md',
          frontmatter: {
            'routine-status': 'deferred',
            'due': '2026-09-29',
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
      ]

      const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates, EVAL_TIME)

      expect(result).toEqual([])
    })

    test('includes notes marked deferred whose deferral timestamp is in the past', () => {
      const candidates = [
        candidate({
          path: 'arrived.md',
          frontmatter: {
            'routine-status': 'deferred',
            'routine-due': '2026-09-26T11:00:00Z',
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
      ]

      const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates, EVAL_TIME)

      expect(result.map(c => c.path)).toEqual(['arrived.md'])
    })

    test('includes notes marked deferred whose deferral timestamp matches evaluation time exactly', () => {
      const candidates = [
        candidate({
          path: 'exact.md',
          frontmatter: {
            'routine-status': 'deferred',
            'routine-due': '2026-09-26T12:00:00Z',
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
      ]

      const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates, EVAL_TIME)

      expect(result.map(c => c.path)).toEqual(['exact.md'])
    })

    test('includes notes marked deferred with an arrived PlainDate', () => {
      const candidates = [
        candidate({
          path: 'today.md',
          frontmatter: {
            'routine-status': 'deferred',
            'next-review': '2026-09-26',
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
      ]

      const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates, EVAL_TIME)

      expect(result.map(c => c.path)).toEqual(['today.md'])
    })

    test('does not exclude notes marked deferred without a review date or with malformed date', () => {
      const candidates = [
        candidate({
          path: 'no-date.md',
          frontmatter: {
            'routine-status': 'deferred',
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
        candidate({
          path: 'malformed.md',
          frontmatter: {
            'routine-status': 'deferred',
            'routine-due': 'not-a-date',
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
      ]

      const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates, EVAL_TIME)

      expect(result.map(c => c.path)).toEqual(['no-date.md', 'malformed.md'])
    })

    test('does not exclude notes with non-deferred status even if review date is in the future', () => {
      const candidates = [
        candidate({
          path: 'pending.md',
          frontmatter: {
            'routine-status': 'pending',
            'routine-due': '2026-09-30T00:00:00Z',
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
        candidate({
          path: 'active.md',
          frontmatter: {
            'routine-status': 'active',
            'next-review': '2026-09-30T00:00:00Z',
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
      ]

      const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates, EVAL_TIME)

      expect(result.map(c => c.path)).toEqual(['pending.md', 'active.md'])
    })

    test('supports Temporal.Instant and Temporal.PlainDate objects directly in frontmatter', () => {
      const candidates = [
        candidate({
          path: 'instant-future.md',
          frontmatter: {
            'routine-status': 'deferred',
            'routine-due': Temporal.Instant.from('2026-09-26T15:00:00Z'),
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
        candidate({
          path: 'plaindate-past.md',
          frontmatter: {
            'routine-status': 'deferred',
            'dueDate': Temporal.PlainDate.from('2026-09-25'),
          },
          getValue: () => ({ toString: () => 'work' }),
        }),
      ]

      const result = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, undefined, candidates, EVAL_TIME)

      expect(result.map(c => c.path)).toEqual(['plaindate-past.md'])
    })
  })
})
