import { describe, expect, test } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import {
  formatBadgeValue,
  projectQueueItemBadges,
} from '../src/domain/queue/queue-badge'
import { PhaseNodeSchema, PhaseQueueBadgeSchema, type PhaseQueueBadge } from '../src/domain/phase/phase'
import { TaskQueueItemIdSchema, type TaskQueueItem } from '../src/domain/queue/task-source'

function createTestItem(extraProperties?: Readonly<Record<string, unknown>>): TaskQueueItem {
  return {
    id: TaskQueueItemIdSchema.parse('test-item-1'),
    sourcePath: 'tasks/task-1.md',
    displayName: 'Task 1',
    cycleStatus: 'pending',
    timeSpent: Temporal.Duration.from({ seconds: 0 }),
    lastCycledAt: null,
    ...(extraProperties !== undefined ? { extraProperties } : {}),
  }
}

describe('formatBadgeValue', () => {
  test('returns null for null, undefined, and NaN', () => {
    expect(formatBadgeValue(null)).toBeNull()
    expect(formatBadgeValue(undefined)).toBeNull()
    expect(formatBadgeValue(Number.NaN)).toBeNull()
  })

  test('formats numbers as strings', () => {
    expect(formatBadgeValue(3)).toBe('3')
    expect(formatBadgeValue(0)).toBe('0')
    expect(formatBadgeValue(2.5)).toBe('2.5')
  })

  test('formats non-empty strings and trims whitespace', () => {
    expect(formatBadgeValue('urgent')).toBe('urgent')
    expect(formatBadgeValue('  review  ')).toBe('review')
  })

  test('returns null for empty or whitespace-only strings', () => {
    expect(formatBadgeValue('')).toBeNull()
    expect(formatBadgeValue('   ')).toBeNull()
  })

  test('formats boolean true as checkmark and false as null', () => {
    expect(formatBadgeValue(true)).toBe('✓')
    expect(formatBadgeValue(false)).toBeNull()
  })

  test('returns null for objects, arrays, and functions', () => {
    expect(formatBadgeValue({})).toBeNull()
    expect(formatBadgeValue(['a', 'b'])).toBeNull()
    expect(formatBadgeValue(() => 1)).toBeNull()
  })
})

describe('projectQueueItemBadges', () => {
  test('returns empty array when item has no extraProperties', () => {
    const item = createTestItem(undefined)
    const configs: readonly PhaseQueueBadge[] = [{ property: 'stars', variant: 'default' }]

    const badges = projectQueueItemBadges(item, configs)
    expect(badges).toEqual([])
  })

  test('returns empty array when configs is empty', () => {
    const item = createTestItem({ stars: 3 })
    const configs: readonly PhaseQueueBadge[] = []

    const badges = projectQueueItemBadges(item, configs)
    expect(badges).toEqual([])
  })

  test('projects matching properties into rendered badge models', () => {
    const item = createTestItem({
      stars: 3,
      estimate: '15m',
      unconfigured: 'ignored',
    })
    const configs: readonly PhaseQueueBadge[] = [
      {
        property: 'stars',
        icon: 'star',
        label: 'Stars',
        suffix: '★',
        variant: 'accent',
      },
      {
        property: 'estimate',
        prefix: '~',
        variant: 'muted',
      },
    ]

    const badges = projectQueueItemBadges(item, configs)
    expect(badges).toEqual([
      {
        property: 'stars',
        text: '3★',
        icon: 'star',
        label: 'Stars',
        variant: 'accent',
      },
      {
        property: 'estimate',
        text: '~15m',
        icon: undefined,
        label: undefined,
        variant: 'muted',
      },
    ])
  })

  test('skips properties missing from extraProperties or evaluating to null', () => {
    const item = createTestItem({
      stars: 5,
      blankText: '   ',
    })
    const configs: readonly PhaseQueueBadge[] = [
      { property: 'missing', variant: 'default' },
      { property: 'blankText', variant: 'default' },
      { property: 'stars', variant: 'default' },
    ]

    const badges = projectQueueItemBadges(item, configs)
    expect(badges).toEqual([
      {
        property: 'stars',
        text: '5',
        icon: undefined,
        label: undefined,
        variant: 'default',
      },
    ])
  })

  test('preserves config ordering rather than object key ordering', () => {
    const item = createTestItem({
      first: 'A',
      second: 'B',
      third: 'C',
    })
    const configs: readonly PhaseQueueBadge[] = [
      { property: 'third', variant: 'default' },
      { property: 'first', variant: 'default' },
    ]

    const badges = projectQueueItemBadges(item, configs)
    expect(badges.map(b => b.property)).toEqual(['third', 'first'])
  })

  test('returns frozen immutable arrays and badge objects', () => {
    const item = createTestItem({ stars: 2 })
    const configs: readonly PhaseQueueBadge[] = [{ property: 'stars', variant: 'default' }]

    const badges = projectQueueItemBadges(item, configs)
    expect(Object.isFrozen(badges)).toBe(true)
    expect(badges[0]).toBeDefined()
    expect(Object.isFrozen(badges[0])).toBe(true)
  })
})

describe('PhaseQueueBadgeSchema', () => {
  test('parses minimal badge config with default variant', () => {
    const parsed = PhaseQueueBadgeSchema.parse({ property: 'score' })
    expect(parsed).toEqual({
      property: 'score',
      variant: 'default',
    })
  })

  test('parses full badge config', () => {
    const parsed = PhaseQueueBadgeSchema.parse({
      property: 'score',
      label: 'Score',
      icon: 'zap',
      prefix: '+',
      suffix: 'pts',
      variant: 'accent',
    })
    expect(parsed).toEqual({
      property: 'score',
      label: 'Score',
      icon: 'zap',
      prefix: '+',
      suffix: 'pts',
      variant: 'accent',
    })
  })

  test('rejects empty property string', () => {
    expect(() => PhaseQueueBadgeSchema.parse({ property: '' })).toThrow()
  })

  test('rejects empty prefix or suffix strings', () => {
    expect(() => PhaseQueueBadgeSchema.parse({ property: 'score', prefix: '' })).toThrow()
    expect(() => PhaseQueueBadgeSchema.parse({ property: 'score', suffix: '' })).toThrow()
  })

  test('PhaseNodeSchema defaults badges to empty array when omitted', () => {
    const parsed = PhaseNodeSchema.parse({
      id: 'work',
      name: 'Work',
      label: 'Work',
      duration: null,
    })
    expect(parsed.badges).toEqual([])
  })

  test('PhaseNodeSchema parses configured badges array', () => {
    const parsed = PhaseNodeSchema.parse({
      id: 'work',
      name: 'Work',
      label: 'Work',
      duration: null,
      badges: [
        { property: 'stars', icon: 'star', variant: 'accent' },
      ],
    })
    expect(parsed.badges).toEqual([
      { property: 'stars', icon: 'star', variant: 'accent' },
    ])
  })
})
