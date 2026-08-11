import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { parseRoutineFile } from '../src/domain/routine/routine-file'
import { PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'

const validPhaseGraph = {
  id: 'standup',
  name: 'Standup routine',
  phases: [
    {
      id: 'turn',
      label: 'Turn',
      kind: 'focus',
      duration: 'PT25M',
      taskSourceId: null,
      completionPolicy: null,
      notification: null,
      logTarget: { kind: 'activeItem' },
      onEnter: null,
      onComplete: null,
      onSkip: null,
      onExit: null,
    },
  ],
  // Self-loop: a real single-phase routine still needs a way out, or checkPhaseGraphIntegrity's
  // "reachable phase with no outgoing transitions" check (flow-gu1.31) rejects it.
  transitions: [{ fromPhaseId: 'turn', toPhaseId: 'turn', condition: { kind: 'always' } }],
}

function routineFile(graph: unknown): string {
  return `---\nis-routine: true\n---\n\n# Standup routine\n\n\`\`\`json\n${JSON.stringify(graph, null, 2)}\n\`\`\`\n`
}

describe('parseRoutineFile', () => {
  test('parses a valid single fenced JSON block into a PhaseGraph', () => {
    const result = parseRoutineFile(routineFile(validPhaseGraph))

    expect(result.success).toBe(true)
    expect(result.success && result.graph.id).toBe(PhaseGraphIdSchema.parse('standup'))
    expect(result.success && result.graph.phases[0]?.duration?.total({ unit: 'minutes' })).toBe(25)
  })

  test('converts a well-formed ISO 8601 duration string to a Temporal.Duration, not a string', () => {
    const result = parseRoutineFile(routineFile(validPhaseGraph))

    expect(result.success).toBe(true)
    expect(typeof (result.success && result.graph.phases[0]?.duration)).not.toBe('string')
  })

  test.each([
    ['queueCycle' as const, { kind: 'queueCycle' as const }],
    ['futureDate' as const, { kind: 'futureDate' as const, after: 'P1D' }],
  ])('parses a %s completionPolicy successfully', (kind, completionPolicy) => {
    const graph = {
      ...validPhaseGraph,
      phases: [{ ...validPhaseGraph.phases[0], completionPolicy }],
    }
    const result = parseRoutineFile(routineFile(graph))

    expect(result.success).toBe(true)
    expect(result.success && result.graph.phases[0]?.completionPolicy?.kind).toBe(kind)
  })

  test('defaults actions to an empty array when omitted from a phase definition', () => {
    const result = parseRoutineFile(routineFile(validPhaseGraph))

    expect(result.success).toBe(true)
    expect(result.success && result.graph.phases[0]?.actions).toEqual([])
  })

  test('parses a phase with actions including queueCycle, markDone, setFrontmatter, and deferDuration', () => {
    const actions = [
      { id: 'act-1', label: 'Cycle', payload: { kind: 'queueCycle' } },
      { id: 'act-2', label: 'Done', style: 'primary', payload: { kind: 'markDone' } },
      { id: 'act-3', label: 'Priority', payload: { kind: 'setFrontmatter', property: 'priority', value: 1 } },
      { id: 'act-4', label: 'Defer 1 day', payload: { kind: 'deferDuration', after: 'P1D' } },
    ]
    const graph = {
      ...validPhaseGraph,
      phases: [{ ...validPhaseGraph.phases[0], actions }],
    }
    const result = parseRoutineFile(routineFile(graph))

    expect(result.success).toBe(true)
    if (result.success) {
      const parsedActions = result.graph.phases[0]?.actions
      expect(parsedActions).toHaveLength(4)
      expect(parsedActions?.[0]).toEqual({ id: 'act-1', label: 'Cycle', payload: { kind: 'queueCycle' } })
      expect(parsedActions?.[1]).toEqual({ id: 'act-2', label: 'Done', style: 'primary', payload: { kind: 'markDone' } })
      expect(parsedActions?.[2]).toEqual({ id: 'act-3', label: 'Priority', payload: { kind: 'setFrontmatter', property: 'priority', value: 1 } })
      expect(parsedActions?.[3]?.id).toBe('act-4')
      expect(parsedActions?.[3]?.payload.kind).toBe('deferDuration')
      if (parsedActions?.[3]?.payload.kind === 'deferDuration') {
        expect(parsedActions[3].payload.after).toEqual(Temporal.Duration.from('P1D'))
      }
    }
  })

  test('a malformed ISO 8601 duration string fails with a RoutineParseError, not a throw', () => {
    const graph = { ...validPhaseGraph, phases: [{ ...validPhaseGraph.phases[0], duration: '25 minutes' }] }

    const result = parseRoutineFile(routineFile(graph))

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.message).toContain('Invalid ISO 8601 duration')
  })

  test('a malformed futureDate duration string fails with a RoutineParseError', () => {
    const graph = {
      ...validPhaseGraph,
      phases: [{ ...validPhaseGraph.phases[0], completionPolicy: { kind: 'futureDate', after: 'not-a-duration' } }],
    }

    const result = parseRoutineFile(routineFile(graph))

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.message).toContain('Invalid ISO 8601 duration')
  })

  test('a malformed deferDuration action duration string fails with a RoutineParseError', () => {
    const graph = {
      ...validPhaseGraph,
      phases: [
        {
          ...validPhaseGraph.phases[0],
          actions: [{ id: 'act-bad', label: 'Bad Defer', payload: { kind: 'deferDuration', after: 'invalid-iso' } }],
        },
      ],
    }

    const result = parseRoutineFile(routineFile(graph))

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.message).toContain('Invalid ISO 8601 duration')
  })

  test('malformed JSON in the fenced block fails with a RoutineParseError, not a throw', () => {
    const content = '---\nis-routine: true\n---\n\n```json\n{ not valid json\n```\n'

    const result = parseRoutineFile(content)

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.message).toContain('not valid JSON')
  })

  test('JSON that fails PhaseGraphSchema validation fails with issue detail', () => {
    const invalidGraph = { ...validPhaseGraph, phases: [] } // PhaseGraphSchema requires phases.min(1)

    const result = parseRoutineFile(routineFile(invalidGraph))

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.issues && result.error.issues.length > 0).toBe(true)
    expect(result.success === false && result.error.issues?.[0]?.path).toEqual(['phases'])
  })

  test('a transition referencing a nonexistent phase id fails referential-integrity validation', () => {
    const graph = {
      ...validPhaseGraph,
      transitions: [{ fromPhaseId: 'turn', toPhaseId: 'ghost', condition: { kind: 'always' } }],
    }

    const result = parseRoutineFile(routineFile(graph))

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.message).toContain('referential-integrity')
    expect(result.success === false && result.error.issues?.[0]?.message).toContain('"ghost"')
  })

  test('a duplicated phase id fails referential-integrity validation', () => {
    const graph = { ...validPhaseGraph, phases: [validPhaseGraph.phases[0], validPhaseGraph.phases[0]] }

    const result = parseRoutineFile(routineFile(graph))

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.issues?.[0]?.message).toBe('Phase id "turn" is declared more than once.')
  })

  test('a reachable phase with no outgoing transitions fails referential-integrity validation', () => {
    const graph = { ...validPhaseGraph, transitions: [] }

    const result = parseRoutineFile(routineFile(graph))

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.issues?.[0]?.message).toContain('no outgoing transitions')
  })

  test('a note body with zero fenced JSON blocks fails with a RoutineParseError', () => {
    const content = '---\nis-routine: true\n---\n\nNo code block here.\n'

    const result = parseRoutineFile(content)

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.message).toContain('no fenced JSON code block')
  })

  test('a note body with multiple fenced JSON blocks fails with a RoutineParseError', () => {
    const content = `---\nis-routine: true\n---\n\n\`\`\`json\n${JSON.stringify(validPhaseGraph)}\n\`\`\`\n\n\`\`\`json\n${JSON.stringify(validPhaseGraph)}\n\`\`\`\n`

    const result = parseRoutineFile(content)

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.message).toContain('2 fenced JSON code blocks')
  })
})
