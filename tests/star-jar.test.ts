import { describe, expect, test } from 'bun:test'
import {
  deriveStarJarState,
  hasAssociatedTracker,
  isRewardPhase,
  resolveGraphTrackerFilePath,
} from '../src/domain/reward/star-jar'
import { PhaseGraphSchema } from '../src/domain/phase/phase-graph'
import { PhaseNodeSchema } from '../src/domain/phase/phase'

describe('deriveStarJarState', () => {
  test('derives state from stars and target properties in frontmatter', () => {
    const state = deriveStarJarState({ stars: 5, target: 15 })
    expect(state.current).toBe(5)
    expect(state.target).toBe(15)
    expect(state.progressFraction).toBeCloseTo(5 / 15, 4)
    expect(state.isFull).toBe(false)
  })

  test('derives state from alternative property names (points, threshold)', () => {
    const state = deriveStarJarState({ points: 20, threshold: 20 })
    expect(state.current).toBe(20)
    expect(state.target).toBe(20)
    expect(state.progressFraction).toBe(1.0)
    expect(state.isFull).toBe(true)
  })

  test('derives state from alternative property names (current, goal)', () => {
    const state = deriveStarJarState({ current: 8, goal: 10 })
    expect(state.current).toBe(8)
    expect(state.target).toBe(10)
    expect(state.progressFraction).toBe(0.8)
    expect(state.isFull).toBe(false)
  })

  test('derives state from alternative property names (balance, max)', () => {
    const state = deriveStarJarState({ balance: 12, max: 10 })
    expect(state.current).toBe(12)
    expect(state.target).toBe(10)
    expect(state.progressFraction).toBe(1.0)
    expect(state.isFull).toBe(true)
  })

  test('falls back to default values when frontmatter is undefined or empty', () => {
    const state = deriveStarJarState(undefined)
    expect(state.current).toBe(0)
    expect(state.target).toBe(15)
    expect(state.progressFraction).toBe(0)
    expect(state.isFull).toBe(false)
  })

  test('sanitizes negative or non-finite inputs gracefully', () => {
    const state = deriveStarJarState({ stars: -5, target: Number.NaN })
    expect(state.current).toBe(0)
    expect(state.target).toBe(15)
    expect(state.progressFraction).toBe(0)
    expect(state.isFull).toBe(false)
  })

  test('respects custom fallback target', () => {
    const state = deriveStarJarState({}, 25)
    expect(state.current).toBe(0)
    expect(state.target).toBe(25)
    expect(state.progressFraction).toBe(0)
  })
})

describe('resolveGraphTrackerFilePath and hasAssociatedTracker', () => {
  test('resolves trackerFilePath directly from graph level', () => {
    const graph = PhaseGraphSchema.parse({
      id: 'star-jar',
      name: 'Star Jar Routine',
      phases: [
        { id: 'focus', name: 'Focus', label: 'Focus', kind: 'focus', duration: 'PT25M' },
      ],
      transitions: [],
      trackerFilePath: 'trackers/star-jar.md',
    })
    expect(resolveGraphTrackerFilePath(graph)).toBe('trackers/star-jar.md')
    expect(hasAssociatedTracker(graph)).toBe(true)
  })

  test('resolves trackerFilePath from custom guard parameters if missing on graph', () => {
    const graph = PhaseGraphSchema.parse({
      id: 'star-jar',
      name: 'Star Jar Routine',
      phases: [
        { id: 'focus', name: 'Focus', label: 'Focus', kind: 'focus', duration: 'PT25M' },
        { id: 'prize', name: 'Prize', label: 'Prize', kind: 'break', duration: 'PT30M' },
      ],
      transitions: [
        {
          from: 'focus',
          to: 'prize',
          guard: {
            kind: 'custom',
            predicateName: 'star-jar-full',
            params: { trackerFilePath: 'notes/tracker.md' },
          },
        },
      ],
    })
    expect(resolveGraphTrackerFilePath(graph)).toBe('notes/tracker.md')
    expect(hasAssociatedTracker(graph)).toBe(true)
  })

  test('returns null and false when no tracker file is configured', () => {
    const graph = PhaseGraphSchema.parse({
      id: 'simple-pomodoro',
      name: 'Simple Pomodoro',
      phases: [
        { id: 'focus', name: 'Focus', label: 'Focus', kind: 'focus', duration: 'PT25M' },
      ],
      transitions: [],
    })
    expect(resolveGraphTrackerFilePath(graph)).toBeNull()
    expect(hasAssociatedTracker(graph)).toBe(false)
  })
})

describe('isRewardPhase', () => {
  const dummyPhase = PhaseNodeSchema.parse({
    id: 'focus',
    name: 'Focus',
    label: 'Focus session',
    kind: 'focus',
    duration: null,
    onCompletion: 'waitForManual',
  })

  test('returns true when phase has resetReward preset in onExit', () => {
    const phase = PhaseNodeSchema.parse({
      ...dummyPhase,
      id: 'celebrate',
      handlers: {
        onExit: [{ kind: 'preset', preset: 'resetReward' }],
      },
    })
    expect(isRewardPhase(phase)).toBe(true)
  })

  test('returns true when phase id is prize-break', () => {
    const phase = PhaseNodeSchema.parse({
      ...dummyPhase,
      id: 'prize-break',
      label: 'Prize break',
      kind: 'break',
    })
    expect(isRewardPhase(phase)).toBe(true)
  })

  test('returns true when phase label contains prize or reward', () => {
    const phase = PhaseNodeSchema.parse({
      ...dummyPhase,
      id: 'break-milestone',
      label: 'Special Reward Interval',
      kind: 'break',
    })
    expect(isRewardPhase(phase)).toBe(true)
  })

  test('returns false for standard focus and break phases without reward presets', () => {
    expect(isRewardPhase(dummyPhase)).toBe(false)
    const shortBreak = PhaseNodeSchema.parse({
      ...dummyPhase,
      id: 'short-break',
      label: 'Short break',
      kind: 'break',
    })
    expect(isRewardPhase(shortBreak)).toBe(false)
  })

  test('returns false for undefined phase', () => {
    expect(isRewardPhase(undefined)).toBe(false)
  })
})
