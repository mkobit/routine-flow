import { test, expect, describe } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import { filterQueueCandidates } from '../src/timer/queue-filter'
import type { QueueFilterCandidate, QueueFilterConfigSource } from '../src/timer/queue-filter'
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
})
