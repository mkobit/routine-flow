import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { LogTargetResolverNameSchema, PhaseSchema } from '../src/domain/phase/phase'
import { PhaseGraphSchema, EdgeGuardSchema } from '../src/domain/phase/phase-graph'
import { HandlerSchema } from '../src/domain/handler/handler'
import { FileMutationSchema } from '../src/domain/mutation/file-mutation'

const minimalPhase = {
  id: 'focus',
  name: 'Focus',
  label: 'Focus',
  kind: 'focus',
  duration: Temporal.Duration.from({ minutes: 25 }),
  onCompletion: 'autoAdvance',
  taskSourceId: null,
  logTarget: { kind: 'activeItem' },
  handlers: {
    onEnter: [],
    onComplete: [],
    onSkip: [],
    onExit: [],
  },
}

describe('PhaseSchema', () => {
  test('parses a phase with all default fields', () => {
    const result = PhaseSchema.safeParse(minimalPhase)
    expect(result.success).toBe(true)
  })

  test('accepts a null duration for manual/until-dismissed phases', () => {
    const result = PhaseSchema.safeParse({ ...minimalPhase, duration: null })
    expect(result.success).toBe(true)
  })

  test('rejects a zero duration', () => {
    const result = PhaseSchema.safeParse({ ...minimalPhase, duration: Temporal.Duration.from({ seconds: 0 }) })
    expect(result.success).toBe(false)
  })
})

describe('PhaseLogTargetSchema', () => {
  test('parses an activeItem log target with no additional parameters', () => {
    const result = PhaseSchema.safeParse({ ...minimalPhase, logTarget: { kind: 'activeItem' } })
    expect(result.success).toBe(true)
  })

  test('parses a callback log target carrying a resolver name', () => {
    const result = PhaseSchema.safeParse({ ...minimalPhase, logTarget: { kind: 'callback', name: 'dailyNote' } })
    expect(result.success).toBe(true)
    expect(result.success && result.data.logTarget).toEqual({ kind: 'callback', name: LogTargetResolverNameSchema.parse('dailyNote') })
  })

  test('rejects the old bare-string enum shape', () => {
    const result = PhaseSchema.safeParse({ ...minimalPhase, logTarget: 'activeItem' })
    expect(result.success).toBe(false)
  })
})

describe('PhaseGraphSchema', () => {
  test('parses a graph with an everyNth transition edge guard', () => {
    const graph = PhaseGraphSchema.parse({
      id: 'routine-v2',
      name: 'Routine',
      phases: [
        minimalPhase,
        { ...minimalPhase, id: 'break', name: 'Break', label: 'Break', kind: 'break' },
      ],
      transitions: [
        { from: 'focus', to: 'break', guard: { kind: 'everyNth', count: 4 } },
      ],
    })
    expect(graph.transitions[0]?.guard.kind).toBe('everyNth')
  })

  test('rejects an empty phases array', () => {
    const result = PhaseGraphSchema.safeParse({ id: 'empty', name: 'Empty', phases: [], transitions: [] })
    expect(result.success).toBe(false)
  })
})

describe('EdgeGuardSchema', () => {
  test('parses a custom guard with a predicate name', () => {
    const result = EdgeGuardSchema.safeParse({ kind: 'custom', predicateName: 'isRestDay' })
    expect(result.success).toBe(true)
  })
})

describe('HandlerSchema', () => {
  test('parses preset handlers', () => {
    expect(HandlerSchema.safeParse({ kind: 'preset', preset: 'markDone' }).success).toBe(true)
    expect(HandlerSchema.safeParse({ kind: 'preset', preset: 'queueCycle' }).success).toBe(true)
    expect(HandlerSchema.safeParse({ kind: 'preset', preset: 'setFrontmatter' }).success).toBe(true)
  })

  test('parses script handlers with path and params', () => {
    const result = HandlerSchema.safeParse({ kind: 'script', scriptPath: 'custom-hook.js', params: { prop: 'val' } })
    expect(result.success).toBe(true)
  })
})

describe('FileMutationSchema', () => {
  test('parses a frontmatter mutation', () => {
    const result = FileMutationSchema.safeParse({ kind: 'frontmatter', filePath: 'task.md', property: 'sessions', value: 1 })
    expect(result.success).toBe(true)
  })

  test('parses a queueStatusChange mutation', () => {
    const result = FileMutationSchema.safeParse({ kind: 'queueStatusChange', itemId: 'item-1', status: 'deferred' })
    expect(result.success).toBe(true)
  })

  test('rejects an unknown kind', () => {
    const result = FileMutationSchema.safeParse({ kind: 'deleteFile', filePath: 'task.md' })
    expect(result.success).toBe(false)
  })
})
