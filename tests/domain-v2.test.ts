import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { LogTargetResolverNameSchema, PhaseSchema } from '../src/domain/phase/phase'
import { PhaseGraphSchema, TransitionConditionSchema } from '../src/domain/phase/phase-graph'
import { CompletionPolicySchema } from '../src/domain/policy/completion-policy'
import { FileMutationSchema } from '../src/domain/mutation/file-mutation'
import { HookReferenceSchema } from '../src/domain/hook/hook-reference'

const minimalPhase = {
  id: 'focus',
  label: 'Focus',
  kind: 'focus',
  duration: Temporal.Duration.from({ minutes: 25 }),
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  logTarget: { kind: 'activeItem' },
  onEnter: null,
  onComplete: null,
  onSkip: null,
  onExit: null,
}

describe('PhaseSchema', () => {
  test('parses a phase with all optional fields null', () => {
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
  test('parses a graph with an everyNth transition', () => {
    const graph = PhaseGraphSchema.parse({
      id: 'routine-v2',
      name: 'Routine',
      phases: [
        minimalPhase,
        { ...minimalPhase, id: 'break', kind: 'break' },
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'everyNth', n: 4 } },
      ],
    })
    expect(graph.transitions[0]?.condition.kind).toBe('everyNth')
  })

  test('rejects an empty phases array', () => {
    const result = PhaseGraphSchema.safeParse({ id: 'empty', name: 'Empty', phases: [], transitions: [] })
    expect(result.success).toBe(false)
  })
})

describe('TransitionConditionSchema', () => {
  test('parses a custom condition with a predicate name', () => {
    const result = TransitionConditionSchema.safeParse({ kind: 'custom', predicate: 'isRestDay' })
    expect(result.success).toBe(true)
  })
})

describe('CompletionPolicySchema', () => {
  test('parses each built-in variant', () => {
    expect(CompletionPolicySchema.safeParse({ kind: 'manualClear' }).success).toBe(true)
    expect(CompletionPolicySchema.safeParse({ kind: 'queueCycle' }).success).toBe(true)
    expect(CompletionPolicySchema.safeParse({ kind: 'noOp' }).success).toBe(true)
  })

  test('rejects the removed custom variant', () => {
    expect(CompletionPolicySchema.safeParse({ kind: 'custom', name: 'my-policy' }).success).toBe(false)
  })

  test('parses futureDate with a positive duration', () => {
    const result = CompletionPolicySchema.safeParse({ kind: 'futureDate', after: Temporal.Duration.from({ days: 3 }) })
    expect(result.success).toBe(true)
  })

  test('rejects futureDate with a zero duration', () => {
    const result = CompletionPolicySchema.safeParse({ kind: 'futureDate', after: Temporal.Duration.from({ seconds: 0 }) })
    expect(result.success).toBe(false)
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

describe('HookReferenceSchema', () => {
  test('parses a reference with params', () => {
    const result = HookReferenceSchema.safeParse({ name: 'increment-frontmatter', params: { property: 'sessions' } })
    expect(result.success).toBe(true)
  })
})
