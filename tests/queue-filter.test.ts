import { Temporal } from 'temporal-polyfill'
import { test, expect, describe } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import { filterQueueCandidates } from '../src/adapters/obsidian/bases/queue-filter'
import type { QueueFilterCandidate, QueueFilterConfigSource } from '../src/adapters/obsidian/bases/queue-filter'
import { createBaseQuerySource } from '../src/adapters/obsidian/bases/query-task-source'
import { FOCUS_PHASE_KIND, BREAK_PHASE_KIND, SELECTOR_PHASE_KIND } from '../src/timer/phase-graph'
import { TaskSourceIdSchema } from '../src/domain/queue/task-source'
import { PhaseQueryFilterSchema } from '../src/domain/phase/phase'
import { createTaskSourceRegistry } from '../src/timer/task-source-registry'

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

  test('uses focusProperty/focusValue fallback for a selector phase', () => {
    const candidates = [
      candidate({ path: 'a.md', getValue: propId => (propId === 'note.type' ? { toString: () => 'work' } : null) }),
      candidate({ path: 'b.md', getValue: propId => (propId === 'note.type' ? { toString: () => 'break' } : null) }),
    ]

    const result = filterQueueCandidates({ kind: SELECTOR_PHASE_KIND }, undefined, candidates)

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

  describe('per-phase task source filtering (flow-1t1.2)', () => {
    test('filters candidates by phase-specific queryFilter property and value', () => {
      const candidates = [
        candidate({ path: 'inbox-1.md', getValue: propId => (propId === 'note.status' ? { toString: () => 'inbox' } : null) }),
        candidate({ path: 'project-1.md', getValue: propId => (propId === 'note.status' ? { toString: () => 'active' } : null) }),
        candidate({ path: 'waiting-1.md', getValue: propId => (propId === 'note.status' ? { toString: () => 'waiting' } : null) }),
      ]

      const phase = {
        kind: FOCUS_PHASE_KIND,
        taskSourceId: TaskSourceIdSchema.parse('inbox-queue'),
        queryFilter: PhaseQueryFilterSchema.parse({ property: 'status', value: 'inbox' }),
      }

      const result = filterQueueCandidates(phase, undefined, candidates)

      expect(result.map(c => c.path)).toEqual(['inbox-1.md'])
    })

    test('supports sequential review phases pulling from distinct query criteria', () => {
      const candidates = [
        candidate({ path: 'inbox-item.md', getValue: propId => (propId === 'note.category' ? { toString: () => 'inbox' } : null) }),
        candidate({ path: 'active-project.md', getValue: propId => (propId === 'note.category' ? { toString: () => 'projects' } : null) }),
        candidate({ path: 'waiting-for.md', getValue: propId => (propId === 'note.category' ? { toString: () => 'waiting' } : null) }),
      ]

      const inboxPhase = {
        kind: FOCUS_PHASE_KIND,
        taskSourceId: TaskSourceIdSchema.parse('inbox-queue'),
        queryFilter: PhaseQueryFilterSchema.parse({ property: 'note.category', value: 'inbox' }),
      }
      const projectsPhase = {
        kind: FOCUS_PHASE_KIND,
        taskSourceId: TaskSourceIdSchema.parse('projects-queue'),
        queryFilter: PhaseQueryFilterSchema.parse({ property: 'note.category', value: 'projects' }),
      }
      const waitingPhase = {
        kind: FOCUS_PHASE_KIND,
        taskSourceId: TaskSourceIdSchema.parse('waiting-queue'),
        queryFilter: PhaseQueryFilterSchema.parse({ property: 'note.category', value: 'waiting' }),
      }

      expect(filterQueueCandidates(inboxPhase, undefined, candidates).map(c => c.path)).toEqual(['inbox-item.md'])
      expect(filterQueueCandidates(projectsPhase, undefined, candidates).map(c => c.path)).toEqual(['active-project.md'])
      expect(filterQueueCandidates(waitingPhase, undefined, candidates).map(c => c.path)).toEqual(['waiting-for.md'])
    })

    test('falls back to focusProperty / breakProperty when queryFilter is not provided', () => {
      const candidates = [
        candidate({ path: 'work.md', getValue: propId => (propId === 'note.type' ? { toString: () => 'work' } : null) }),
        candidate({ path: 'break.md', getValue: propId => (propId === 'note.type' ? { toString: () => 'break' } : null) }),
      ]

      const focusPhase = { kind: FOCUS_PHASE_KIND, taskSourceId: TaskSourceIdSchema.parse('focus-queue') }
      const breakPhase = { kind: BREAK_PHASE_KIND, taskSourceId: TaskSourceIdSchema.parse('break-queue') }

      expect(filterQueueCandidates(focusPhase, undefined, candidates).map(c => c.path)).toEqual(['work.md'])
      expect(filterQueueCandidates(breakPhase, undefined, candidates).map(c => c.path)).toEqual(['break.md'])
    })

    test('matches queryFilter value case-insensitively', () => {
      const candidates = [
        candidate({ path: 'item.md', getValue: propId => (propId === 'note.status' ? { toString: () => 'INBOX' } : null) }),
      ]

      const phase = {
        kind: FOCUS_PHASE_KIND,
        queryFilter: PhaseQueryFilterSchema.parse({ property: 'status', value: 'inbox' }),
      }

      const result = filterQueueCandidates(phase, undefined, candidates)

      expect(result.map(c => c.path)).toEqual(['item.md'])
    })

    test('falls back to kind default value when queryFilter has empty-string value', () => {
      const candidates = [
        candidate({ path: 'work.md', getValue: propId => (propId === 'note.status' ? { toString: () => 'work' } : null) }),
      ]

      const phase = {
        kind: FOCUS_PHASE_KIND,
        queryFilter: PhaseQueryFilterSchema.parse({ property: 'status', value: '' }),
      }

      const result = filterQueueCandidates(phase, undefined, candidates)

      expect(result.map(c => c.path)).toEqual(['work.md'])
    })

    test('TaskSourceRegistry provides distinct queues when advancing between review phases', () => {
      const candidates = [
        candidate({ path: 'inbox-item.md', getValue: propId => (propId === 'note.status' ? { toString: () => 'inbox' } : null) }),
        candidate({ path: 'active-project.md', getValue: propId => (propId === 'note.status' ? { toString: () => 'active' } : null) }),
        candidate({ path: 'waiting-task.md', getValue: propId => (propId === 'note.status' ? { toString: () => 'waiting' } : null) }),
      ]

      const inboxPhase = {
        kind: FOCUS_PHASE_KIND,
        taskSourceId: TaskSourceIdSchema.parse('inbox-queue'),
        queryFilter: PhaseQueryFilterSchema.parse({ property: 'note.status', value: 'inbox' }),
      }
      const projectsPhase = {
        kind: FOCUS_PHASE_KIND,
        taskSourceId: TaskSourceIdSchema.parse('projects-queue'),
        queryFilter: PhaseQueryFilterSchema.parse({ property: 'note.status', value: 'active' }),
      }
      const waitingPhase = {
        kind: FOCUS_PHASE_KIND,
        taskSourceId: TaskSourceIdSchema.parse('waiting-queue'),
        queryFilter: PhaseQueryFilterSchema.parse({ property: 'note.status', value: 'waiting' }),
      }

      const registry = createTaskSourceRegistry()
      for (const p of [inboxPhase, projectsPhase, waitingPhase]) {
        registry.register(p.taskSourceId, createBaseQuerySource(filterQueueCandidates(p, undefined, candidates)))
      }

      expect(registry.resolve(inboxPhase.taskSourceId)?.getQueue().map(c => c.sourcePath)).toEqual(['inbox-item.md'])
      expect(registry.resolve(projectsPhase.taskSourceId)?.getQueue().map(c => c.sourcePath)).toEqual(['active-project.md'])
      expect(registry.resolve(waitingPhase.taskSourceId)?.getQueue().map(c => c.sourcePath)).toEqual(['waiting-task.md'])
    })
  })
})
