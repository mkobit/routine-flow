import { test, expect, describe } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import { filterQueueCandidates } from '../src/timer/queue-filter'
import type { QueueFilterCandidate, QueueFilterConfigSource } from '../src/timer/queue-filter'
import { FOCUS_PHASE_KIND, BREAK_PHASE_KIND } from '../src/timer/phase-graph'

const isPropertyId = (val: unknown): val is BasesPropertyId => typeof val === 'string' && val.length > 0

class MockBasesViewConfig implements QueueFilterConfigSource {
  private options: Map<string, unknown> = new Map()

  get(key: string): unknown {
    return this.options.get(key)
  }

  getAsPropertyId(key: string): BasesPropertyId | null {
    const val = this.options.get(key)
    return isPropertyId(val) ? val : null
  }

  set(key: string, value: unknown): void {
    if (value === null || value === undefined || value === '') {
      this.options.delete(key)
    }
    else {
      this.options.set(key, value)
    }
  }
}

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

describe('Inline Bases view configuration and queue filtering', () => {
  test('dynamically updates focus queue when focusProperty and focusValue are changed via config.set', () => {
    const config = new MockBasesViewConfig()
    const candidates = [
      candidate({ path: 'a.md', getValue: prop => (prop === 'note.category' ? { toString: () => 'deep-work' } : null) }),
      candidate({ path: 'b.md', getValue: prop => (prop === 'note.category' ? { toString: () => 'admin' } : null) }),
    ]

    // Default configuration (note.type / work) matches neither
    expect(filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, config, candidates)).toEqual([])

    // Update config dynamically via set
    config.set('focusProperty', 'note.category')
    config.set('focusValue', 'deep-work')

    const filtered = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, config, candidates)
    expect(filtered.map(c => c.path)).toEqual(['a.md'])

    // Change focus value to admin
    config.set('focusValue', 'admin')
    const filteredAdmin = filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, config, candidates)
    expect(filteredAdmin.map(c => c.path)).toEqual(['b.md'])
  })

  test('dynamically updates break queue when breakProperty and breakValue are changed via config.set', () => {
    const config = new MockBasesViewConfig()
    const candidates = [
      candidate({ path: 'walk.md', getValue: prop => (prop === 'note.tag' ? { toString: () => 'outdoor' } : null) }),
      candidate({ path: 'coffee.md', getValue: prop => (prop === 'note.tag' ? { toString: () => 'indoor' } : null) }),
    ]

    config.set('breakProperty', 'note.tag')
    config.set('breakValue', 'outdoor')

    const filtered = filterQueueCandidates({ kind: BREAK_PHASE_KIND }, config, candidates)
    expect(filtered.map(c => c.path)).toEqual(['walk.md'])
  })

  test('clearing config keys resets queue filter to default fallback', () => {
    const config = new MockBasesViewConfig()
    config.set('focusProperty', 'note.category')
    config.set('focusValue', 'deep-work')

    const candidates = [
      candidate({ path: 'a.md', getValue: prop => (prop === 'note.type' ? { toString: () => 'work' } : null) }),
    ]

    expect(filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, config, candidates)).toEqual([])

    // Clear options
    config.set('focusProperty', null)
    config.set('focusValue', null)

    expect(filterQueueCandidates({ kind: FOCUS_PHASE_KIND }, config, candidates).map(c => c.path)).toEqual(['a.md'])
  })
})
