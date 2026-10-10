import { describe, expect, test } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import {
  CadenceRuleSchema,
  CadenceRulesetSchema,
  resolveCadenceRoutine,
  type CadenceContext,
  type CadenceRule,
} from '../src/domain/routine/cadence-selection'
import { runCadenceRoutine } from '../src/timer/routine-selection'
import { PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'

describe('Cadence selection domain model and schemas', () => {
  test('validates CadenceRule schema with daysOfWeek and time range', () => {
    const rawRule = {
      id: 'daily-standup',
      routinePath: 'Routines/Standup.md',
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '10:00',
      tags: ['work'],
    }
    const parsed = CadenceRuleSchema.parse(rawRule)
    expect(parsed.id).toBe('daily-standup')
    expect(parsed.routinePath).toBe('Routines/Standup.md')
    expect(parsed.daysOfWeek).toEqual([1, 2, 3, 4, 5])
    expect(parsed.startTime).toBe('09:00')
    expect(parsed.endTime).toBe('10:00')
    expect(parsed.tags).toEqual(['work'])
  })

  test('validates minimal CadenceRule without optional filters', () => {
    const rawRule = {
      id: 'fallback-focus',
      routinePath: 'Routines/Focus.md',
    }
    const parsed = CadenceRuleSchema.parse(rawRule)
    expect(parsed.id).toBe('fallback-focus')
    expect(parsed.routinePath).toBe('Routines/Focus.md')
    expect(parsed.daysOfWeek).toBeUndefined()
    expect(parsed.startTime).toBeUndefined()
    expect(parsed.endTime).toBeUndefined()
    expect(parsed.tags).toBeUndefined()
  })

  test('validates CadenceRuleset schema', () => {
    const ruleset = CadenceRulesetSchema.parse({
      rules: [
        {
          id: 'rule-1',
          routinePath: 'Routines/Daily.md',
        },
      ],
    })
    expect(ruleset.rules).toHaveLength(1)
  })
})

describe('resolveCadenceRoutine pure resolver', () => {
  // Monday 2026-10-12 at 09:30 UTC
  // 2026-10-12 is Monday (dayOfWeek: 1)
  const mondayMorningInstant = Temporal.Instant.from('2026-10-12T09:30:00Z')
  // Saturday 2026-10-17 at 10:00 UTC (dayOfWeek: 6)
  const saturdayInstant = Temporal.Instant.from('2026-10-17T10:00:00Z')

  const workdaysMorningRule: CadenceRule = {
    id: 'morning-kickoff',
    routinePath: 'Routines/Kickoff.md',
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '11:00',
  }

  const weeklyReviewRule: CadenceRule = {
    id: 'weekly-review',
    routinePath: 'Routines/Weekly-Review.md',
    daysOfWeek: [5], // Friday
    startTime: '16:00',
    endTime: '18:00',
  }

  const tagSpecificRule: CadenceRule = {
    id: 'sprint-retro',
    routinePath: 'Routines/Sprint-Retro.md',
    tags: ['sprint-close', 'planning'],
  }

  const defaultFallbackRule: CadenceRule = {
    id: 'general-focus',
    routinePath: 'Routines/Focus.md',
  }

  test('resolves rule matching day of week and time range in specified timeZone', () => {
    const context: CadenceContext = {
      now: mondayMorningInstant,
      timeZone: 'UTC',
    }
    const resolved = resolveCadenceRoutine([workdaysMorningRule, defaultFallbackRule], context)
    expect(resolved).not.toBeNull()
    expect(resolved?.id).toBe('morning-kickoff')
    expect(resolved?.routinePath).toBe('Routines/Kickoff.md')
  })

  test('skips rule when day of week does not match', () => {
    const context: CadenceContext = {
      now: saturdayInstant,
      timeZone: 'UTC',
    }
    const resolved = resolveCadenceRoutine([workdaysMorningRule, defaultFallbackRule], context)
    expect(resolved?.id).toBe('general-focus')
  })

  test('skips rule when time of day is outside range', () => {
    // Monday at 12:00 UTC (outside 09:00-11:00)
    const mondayNoon = Temporal.Instant.from('2026-10-12T12:00:00Z')
    const context: CadenceContext = {
      now: mondayNoon,
      timeZone: 'UTC',
    }
    const resolved = resolveCadenceRoutine([workdaysMorningRule, defaultFallbackRule], context)
    expect(resolved?.id).toBe('general-focus')
  })

  test('matches tags when provided in context frontmatterTags', () => {
    const context: CadenceContext = {
      now: mondayMorningInstant,
      timeZone: 'UTC',
      tags: ['planning', 'other-tag'],
    }
    const resolved = resolveCadenceRoutine([tagSpecificRule, defaultFallbackRule], context)
    expect(resolved?.id).toBe('sprint-retro')
  })

  test('skips rule when tags do not intersect', () => {
    const context: CadenceContext = {
      now: mondayMorningInstant,
      timeZone: 'UTC',
      tags: ['unrelated'],
    }
    const resolved = resolveCadenceRoutine([tagSpecificRule, defaultFallbackRule], context)
    expect(resolved?.id).toBe('general-focus')
  })

  test('returns null when no rules match and no fallback exists', () => {
    const context: CadenceContext = {
      now: saturdayInstant,
      timeZone: 'UTC',
    }
    const resolved = resolveCadenceRoutine([workdaysMorningRule, weeklyReviewRule], context)
    expect(resolved).toBeNull()
  })

  test('evaluates rules in priority order (first match wins)', () => {
    const highPriorityRule: CadenceRule = {
      id: 'high-priority',
      routinePath: 'Routines/High.md',
      daysOfWeek: [1],
    }
    const lowerPriorityRule: CadenceRule = {
      id: 'lower-priority',
      routinePath: 'Routines/Lower.md',
      daysOfWeek: [1],
    }
    const context: CadenceContext = {
      now: mondayMorningInstant,
      timeZone: 'UTC',
    }
    const resolved = resolveCadenceRoutine([highPriorityRule, lowerPriorityRule], context)
    expect(resolved?.id).toBe('high-priority')
  })
})

describe('runCadenceRoutine launcher and active session clobbering prevention', () => {
  const sampleRoutine = {
    id: 'cadence-routine',
    name: 'Cadence Routine',
    phases: [
      {
        id: 'phase-1',
        label: 'Phase 1',
        kind: 'focus',
        duration: 'PT10M',
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
    transitions: [{ fromPhaseId: 'phase-1', toPhaseId: 'phase-1', condition: { kind: 'always' } }],
  }

  const sampleRoutineContent = `\`\`\`json\n${JSON.stringify(sampleRoutine)}\n\`\`\`\n`

  test('runs matched routine immediately when active session is stopped', async () => {
    let loadedPath = ''
    let dispatchedAction = ''
    let activated = false

    const deps = {
      readRoutineFile: async (path: string) => {
        loadedPath = path
        return sampleRoutineContent
      },
      getActiveRoutine: () => ({
        graphId: PhaseGraphIdSchema.parse('default'),
        graphName: 'Default Routine',
        status: 'stopped' as const,
      }),
      confirmReplace: async () => 'confirmed' as const,
      setGraph: () => {},
      dispatch: async (action: { type: string }) => {
        dispatchedAction = action.type
      },
      activateView: async () => {
        activated = true
      },
    }

    const rules = [
      {
        id: 'matched-rule',
        routinePath: 'Routines/Sample.md',
      },
    ]

    const result = await runCadenceRoutine(rules, { now: Temporal.Now.instant() }, deps)

    expect(result).toBe('started')
    expect(loadedPath).toBe('Routines/Sample.md')
    expect(dispatchedAction).toBe('start')
    expect(activated).toBe(true)
  })

  test('prompts confirmation via RoutineReplaceModal when session is in progress with different routine', async () => {
    let confirmCalled = false
    let currentRoutineArg = ''
    let nextRoutineArg = ''

    const deps = {
      readRoutineFile: async () => sampleRoutineContent,
      getActiveRoutine: () => ({
        graphId: PhaseGraphIdSchema.parse('active-other'),
        graphName: 'Running Other Routine',
        status: 'running' as const,
      }),
      confirmReplace: async (current: string, next: string) => {
        confirmCalled = true
        currentRoutineArg = current
        nextRoutineArg = next
        return 'confirmed' as const
      },
      setGraph: () => {},
      dispatch: async () => {},
      activateView: async () => {},
    }

    const rules = [{ id: 'rule-1', routinePath: 'Routines/Sample.md' }]
    const result = await runCadenceRoutine(rules, { now: Temporal.Now.instant() }, deps)

    expect(confirmCalled).toBe(true)
    expect(currentRoutineArg).toBe('Running Other Routine')
    expect(nextRoutineArg).toBe('Cadence Routine')
    expect(result).toBe('started')
  })

  test('cancels launch when confirmation is rejected (prevents clobbering)', async () => {
    let setGraphCalled = false
    let dispatchCalled = false

    const deps = {
      readRoutineFile: async () => sampleRoutineContent,
      getActiveRoutine: () => ({
        graphId: PhaseGraphIdSchema.parse('active-other'),
        graphName: 'Running Other Routine',
        status: 'running' as const,
      }),
      confirmReplace: async () => 'cancelled' as const,
      setGraph: () => {
        setGraphCalled = true
      },
      dispatch: async () => {
        dispatchCalled = true
      },
      activateView: async () => {},
    }

    const rules = [{ id: 'rule-1', routinePath: 'Routines/Sample.md' }]
    const result = await runCadenceRoutine(rules, { now: Temporal.Now.instant() }, deps)

    expect(result).toBe('cancelled')
    expect(setGraphCalled).toBe(false)
    expect(dispatchCalled).toBe(false)
  })

  test('returns not-found when no rules match', async () => {
    const deps = {
      readRoutineFile: async () => sampleRoutineContent,
      getActiveRoutine: () => ({
        graphId: PhaseGraphIdSchema.parse('default'),
        graphName: 'Default',
        status: 'stopped' as const,
      }),
      confirmReplace: async () => 'confirmed' as const,
      setGraph: () => {},
      dispatch: async () => {},
      activateView: async () => {},
    }

    const result = await runCadenceRoutine([], { now: Temporal.Now.instant() }, deps)
    expect(result).toBe('no-match')
  })
})
