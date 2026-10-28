import { test, expect, describe } from 'bun:test'
import { PhaseNodeSchema } from '../src/domain/phase/phase'
import { parseRoutineFile } from '../src/domain/routine/routine-file'

describe('PhaseNodeSchema guidance', () => {
  const basePhase = {
    id: 'review-inbox',
    name: 'Review inbox',
    label: 'Review inbox',
    duration: null,
  }

  test('parses phase with guidance string array', () => {
    const phase = PhaseNodeSchema.parse({
      ...basePhase,
      guidance: ['Check unread emails', 'Clear task inbox'],
    })

    expect(phase.guidance).toEqual(['Check unread emails', 'Clear task inbox'])
  })

  test('normalizes checklist alias to guidance property', () => {
    const phase = PhaseNodeSchema.parse({
      ...basePhase,
      checklist: ['Item A', 'Item B'],
    })

    expect(phase.guidance).toEqual(['Item A', 'Item B'])
  })

  test('allows phase without guidance or checklist', () => {
    const phase = PhaseNodeSchema.parse(basePhase)

    expect(phase.guidance).toBeUndefined()
  })

  test('rejects empty string in guidance list', () => {
    expect(() => {
      PhaseNodeSchema.parse({
        ...basePhase,
        guidance: ['Valid item', ''],
      })
    }).toThrow()
  })

  test('rejects non-string items in guidance list', () => {
    expect(() => {
      PhaseNodeSchema.parse({
        ...basePhase,
        guidance: [123],
      })
    }).toThrow()
  })
})

describe('parseRoutineFile guidance support', () => {
  function makeRoutineContent(phases: readonly unknown[]): string {
    const routine = {
      id: 'routine-guidance',
      name: 'Routine with guidance',
      phases,
      transitions: [
        { from: 'phase-1', to: 'phase-1', guard: { kind: 'always' } },
      ],
    }
    return `---\nis-routine: true\n---\n\n\`\`\`json\n${JSON.stringify(routine, null, 2)}\n\`\`\`\n`
  }

  test('parses routine note with guidance checklist items', () => {
    const content = makeRoutineContent([
      {
        id: 'phase-1',
        name: 'Step 1',
        duration: 'PT15M',
        guidance: ['Check inbox', 'Process action items'],
      },
    ])

    const result = parseRoutineFile(content)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.graph.phases[0]?.guidance).toEqual(['Check inbox', 'Process action items'])
    }
  })

  test('normalizes checklist alias in routine file to guidance', () => {
    const content = makeRoutineContent([
      {
        id: 'phase-1',
        name: 'Step 1',
        duration: 'PT15M',
        checklist: ['Step A', 'Step B'],
      },
    ])

    const result = parseRoutineFile(content)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.graph.phases[0]?.guidance).toEqual(['Step A', 'Step B'])
    }
  })
})
