import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { describe, expect, test } from 'bun:test'
import { parseRoutineFile } from '../src/domain/routine/routine-file'
import {
  resolveCadenceRoutine,
  type CadenceRule,
  type CadenceContext,
} from '../src/domain/routine/cadence-selection'
import { runCadenceRoutine, decideStartAction } from '../src/timer/routine-selection'
import { filterQueueCandidates, type QueueFilterCandidate } from '../src/adapters/obsidian/bases/queue-filter'
import { createBaseQuerySource } from '../src/adapters/obsidian/bases/query-task-source'
import { createTaskSourceRegistry } from '../src/timer/task-source-registry'
import { deriveStageProgress } from '../src/domain/phase/stage-progress'
import { EngineStore } from '../src/timer/store'
import {
  generateReviewCadencesNotes,
  DEFAULT_VAULT_SEED,
} from '../e2e/vault/generator'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import { PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'
import { PhaseIdSchema } from '../src/domain/phase/phase'
import type { EngineState } from '../src/domain/session/engine-state'

const EXAMPLE_VAULT_DIR = path.resolve(__dirname, '../routine-flow-example-vault')

async function loadRoutine(relativeRoutinePath: string): Promise<PhaseGraph> {
  const fullPath = path.join(EXAMPLE_VAULT_DIR, relativeRoutinePath)
  const content = await fs.readFile(fullPath, 'utf-8')
  const result = parseRoutineFile(content)
  if (!result.success) {
    throw new Error(`Failed to parse routine file at ${relativeRoutinePath}: ${result.error.message}`)
  }
  return result.graph
}

describe('Structured review cadences domain integration suite', () => {
  describe('Routine file schemas and graph structure', () => {
    test('weekly GTD review routine parses valid multi-phase review DAG with queueExhausted guards', async () => {
      const graph = await loadRoutine('review-cadences/weekly-gtd-routine.md')

      expect(graph.id).toBe(PhaseGraphIdSchema.parse('weekly-gtd'))
      expect(graph.name).toBe('Weekly GTD review')
      expect(graph.phases).toHaveLength(5)

      const [inbox, projects, waiting, someday, planning] = graph.phases
      expect(inbox?.id).toBe(PhaseIdSchema.parse('inbox-clear'))
      expect(String(inbox?.kind)).toBe('review')
      expect(String(inbox?.taskSourceId)).toBe('inbox-queue')
      expect(inbox?.queryFilter).toEqual({ property: 'note.status', value: 'inbox' })
      expect(inbox?.guidance).toHaveLength(3)

      expect(projects?.id).toBe(PhaseIdSchema.parse('project-review'))
      expect(String(projects?.kind)).toBe('review')
      expect(String(projects?.taskSourceId)).toBe('projects-queue')
      expect(projects?.queryFilter).toEqual({ property: 'note.status', value: 'active' })
      expect(projects?.guidance).toHaveLength(3)

      expect(waiting?.id).toBe(PhaseIdSchema.parse('waiting-review'))
      expect(String(waiting?.kind)).toBe('review')
      expect(String(waiting?.taskSourceId)).toBe('waiting-queue')
      expect(waiting?.queryFilter).toEqual({ property: 'note.status', value: 'waiting' })
      expect(waiting?.guidance).toHaveLength(3)

      expect(someday?.id).toBe(PhaseIdSchema.parse('someday-maybe'))
      expect(String(someday?.kind)).toBe('ritual')
      expect(someday?.taskSourceId).toBeNull()

      expect(planning?.id).toBe(PhaseIdSchema.parse('weekly-planning'))
      expect(String(planning?.kind)).toBe('ritual')
      expect(planning?.taskSourceId).toBeNull()
      expect(planning?.onCompletion).toBe('waitForManual')

      const exhaustedTransitions = graph.transitions.filter(
        t => (t.guard ?? t.condition)?.kind === 'queueExhausted',
      )
      expect(exhaustedTransitions).toHaveLength(3)
    })

    test('daily kickoff routine parses sequential morning triage and focus phases', async () => {
      const graph = await loadRoutine('review-cadences/daily-kickoff-routine.md')

      expect(graph.id).toBe(PhaseGraphIdSchema.parse('daily-kickoff'))
      expect(graph.name).toBe('Daily kickoff routine')
      expect(graph.phases).toHaveLength(4)

      const [hydration, inbox, priority, plan] = graph.phases
      expect(hydration?.id).toBe(PhaseIdSchema.parse('morning-hydration'))
      expect(String(hydration?.kind)).toBe('ritual')
      expect(hydration?.taskSourceId).toBeNull()

      expect(inbox?.id).toBe(PhaseIdSchema.parse('daily-inbox'))
      expect(String(inbox?.kind)).toBe('review')
      expect(String(inbox?.taskSourceId)).toBe('inbox-queue')
      expect(inbox?.queryFilter).toEqual({ property: 'note.status', value: 'inbox' })

      expect(priority?.id).toBe(PhaseIdSchema.parse('priority-focus'))
      expect(String(priority?.kind)).toBe('focus')
      expect(String(priority?.taskSourceId)).toBe('projects-queue')
      expect(priority?.queryFilter).toEqual({ property: 'note.status', value: 'active' })

      expect(plan?.id).toBe(PhaseIdSchema.parse('workday-launch'))
      expect(String(plan?.kind)).toBe('ritual')
      expect(plan?.onCompletion).toBe('waitForManual')
    })

    test('workday shutdown routine parses closure inbox sweep, waiting check, and planning', async () => {
      const graph = await loadRoutine('review-cadences/workday-shutdown-routine.md')

      expect(graph.id).toBe(PhaseGraphIdSchema.parse('workday-shutdown'))
      expect(graph.name).toBe('Workday shutdown routine')
      expect(graph.phases).toHaveLength(4)

      const [sweep, waiting, planTomorrow, deskTidy] = graph.phases
      expect(sweep?.id).toBe(PhaseIdSchema.parse('inbox-sweep'))
      expect(String(sweep?.kind)).toBe('review')
      expect(String(sweep?.taskSourceId)).toBe('inbox-queue')
      expect(sweep?.queryFilter).toEqual({ property: 'note.status', value: 'inbox' })

      expect(waiting?.id).toBe(PhaseIdSchema.parse('waiting-check'))
      expect(String(waiting?.kind)).toBe('review')
      expect(String(waiting?.taskSourceId)).toBe('waiting-queue')
      expect(waiting?.queryFilter).toEqual({ property: 'note.status', value: 'waiting' })

      expect(planTomorrow?.id).toBe(PhaseIdSchema.parse('plan-tomorrow'))
      expect(deskTidy?.id).toBe(PhaseIdSchema.parse('desk-tidy'))
      expect(deskTidy?.onCompletion).toBe('waitForManual')
    })
  })

  describe('Criteria-based routine selection integration', () => {
    const weeklyGtdRule: CadenceRule = {
      id: 'friday-gtd-review',
      routinePath: 'review-cadences/weekly-gtd-routine.md',
      daysOfWeek: [5], // Friday
      startTime: '14:00',
      endTime: '18:00',
    }

    const dailyKickoffRule: CadenceRule = {
      id: 'workday-morning-kickoff',
      routinePath: 'review-cadences/daily-kickoff-routine.md',
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '08:00',
      endTime: '10:00',
    }

    const workdayShutdownRule: CadenceRule = {
      id: 'workday-evening-shutdown',
      routinePath: 'review-cadences/workday-shutdown-routine.md',
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '16:30',
      endTime: '18:30',
    }

    const taggedReviewRule: CadenceRule = {
      id: 'tag-triggered-weekly-review',
      routinePath: 'review-cadences/weekly-gtd-routine.md',
      tags: ['weekly-review', 'gtd'],
    }

    const rules = [weeklyGtdRule, dailyKickoffRule, workdayShutdownRule, taggedReviewRule]

    test('resolves weekly GTD review on Friday afternoon', () => {
      // 2026-10-16 is a Friday. 15:30 UTC
      const fridayAfternoon = Temporal.Instant.from('2026-10-16T15:30:00Z')
      const context: CadenceContext = { now: fridayAfternoon, timeZone: 'UTC' }

      const resolved = resolveCadenceRoutine(rules, context)
      expect(resolved?.id).toBe('friday-gtd-review')
      expect(resolved?.routinePath).toBe('review-cadences/weekly-gtd-routine.md')
    })

    test('resolves daily kickoff on weekday morning', () => {
      // 2026-10-14 is Wednesday. 08:30 UTC
      const wednesdayMorning = Temporal.Instant.from('2026-10-14T08:30:00Z')
      const context: CadenceContext = { now: wednesdayMorning, timeZone: 'UTC' }

      const resolved = resolveCadenceRoutine(rules, context)
      expect(resolved?.id).toBe('workday-morning-kickoff')
      expect(resolved?.routinePath).toBe('review-cadences/daily-kickoff-routine.md')
    })

    test('resolves workday shutdown on weekday evening', () => {
      // 2026-10-14 is Wednesday. 17:00 UTC
      const wednesdayEvening = Temporal.Instant.from('2026-10-14T17:00:00Z')
      const context: CadenceContext = { now: wednesdayEvening, timeZone: 'UTC' }

      const resolved = resolveCadenceRoutine(rules, context)
      expect(resolved?.id).toBe('workday-evening-shutdown')
      expect(resolved?.routinePath).toBe('review-cadences/workday-shutdown-routine.md')
    })

    test('resolves tagged review cadence outside standard schedule window', () => {
      // Monday 12:00 UTC (not matching morning or shutdown time range)
      const mondayNoon = Temporal.Instant.from('2026-10-12T12:00:00Z')
      const context: CadenceContext = {
        now: mondayNoon,
        timeZone: 'UTC',
        tags: ['weekly-review'],
      }

      const resolved = resolveCadenceRoutine(rules, context)
      expect(resolved?.id).toBe('tag-triggered-weekly-review')
      expect(resolved?.routinePath).toBe('review-cadences/weekly-gtd-routine.md')
    })

    test('returns null when time does not match scheduled cadences and no tag provided', () => {
      // Saturday 14:00 UTC
      const saturdayAfternoon = Temporal.Instant.from('2026-10-17T14:00:00Z')
      const context: CadenceContext = { now: saturdayAfternoon, timeZone: 'UTC' }

      const resolved = resolveCadenceRoutine(rules, context)
      expect(resolved).toBeNull()
    })
  })

  describe('Per-phase task source filtering and multi-query registry binding', () => {
    const generatedNotes = generateReviewCadencesNotes(DEFAULT_VAULT_SEED)
    const taskNotes = generatedNotes.filter(
      note => note.relativePath.base !== 'README.md' && !note.relativePath.base.endsWith('-routine.md'),
    )

    const candidates: readonly QueueFilterCandidate[] = taskNotes.map(note => ({
      path: `review-cadences/${note.relativePath.base}`,
      basename: note.relativePath.base.replace(/\.md$/, ''),
      frontmatter: note.frontmatter,
      getValue: (propertyId) => {
        if (propertyId === 'note.status') {
          const val = note.frontmatter.status
          return val !== undefined ? { toString: () => String(val) } : null
        }
        if (propertyId === 'note.category') {
          const val = note.frontmatter.category
          return val !== undefined ? { toString: () => String(val) } : null
        }
        return null
      },
    }))

    test('weekly GTD review phases bind exclusively to inbox, active project, and waiting queries', async () => {
      const graph = await loadRoutine('review-cadences/weekly-gtd-routine.md')
      const [inboxPhase, projectsPhase, waitingPhase, somedayPhase, planningPhase] = graph.phases

      expect(inboxPhase).toBeDefined()
      expect(projectsPhase).toBeDefined()
      expect(waitingPhase).toBeDefined()

      const inboxItems = filterQueueCandidates(inboxPhase!, undefined, candidates)
      const projectItems = filterQueueCandidates(projectsPhase!, undefined, candidates)
      const waitingItems = filterQueueCandidates(waitingPhase!, undefined, candidates)

      expect(inboxItems).toHaveLength(3)
      expect(inboxItems.every(c => c.frontmatter?.status === 'inbox')).toBe(true)

      expect(projectItems).toHaveLength(3)
      expect(projectItems.every(c => c.frontmatter?.status === 'active')).toBe(true)

      expect(waitingItems).toHaveLength(3)
      expect(waitingItems.every(c => c.frontmatter?.status === 'waiting')).toBe(true)

      // Ritual phases without queryFilter produce empty candidate sets
      const somedayItems = filterQueueCandidates(somedayPhase!, undefined, candidates)
      const planningItems = filterQueueCandidates(planningPhase!, undefined, candidates)
      expect(somedayItems).toHaveLength(0)
      expect(planningItems).toHaveLength(0)

      // TaskSourceRegistry isolates each phase's queue correctly
      const registry = createTaskSourceRegistry()
      registry.register(inboxPhase!.taskSourceId!, createBaseQuerySource(inboxItems))
      registry.register(projectsPhase!.taskSourceId!, createBaseQuerySource(projectItems))
      registry.register(waitingPhase!.taskSourceId!, createBaseQuerySource(waitingItems))

      expect(registry.resolve(inboxPhase!.taskSourceId!)?.getQueue()).toHaveLength(3)
      expect(registry.resolve(projectsPhase!.taskSourceId!)?.getQueue()).toHaveLength(3)
      expect(registry.resolve(waitingPhase!.taskSourceId!)?.getQueue()).toHaveLength(3)
    })

    test('daily kickoff phases switch from inbox review to priority focus', async () => {
      const graph = await loadRoutine('review-cadences/daily-kickoff-routine.md')
      const [, inboxPhase, priorityPhase] = graph.phases

      const inboxItems = filterQueueCandidates(inboxPhase!, undefined, candidates)
      const priorityItems = filterQueueCandidates(priorityPhase!, undefined, candidates)

      expect(inboxItems).toHaveLength(3)
      expect(inboxItems.every(c => c.frontmatter?.status === 'inbox')).toBe(true)

      expect(priorityItems).toHaveLength(3)
      expect(priorityItems.every(c => c.frontmatter?.status === 'active')).toBe(true)
    })

    test('workday shutdown phases switch from inbox sweep to waiting-for check', async () => {
      const graph = await loadRoutine('review-cadences/workday-shutdown-routine.md')
      const [sweepPhase, waitingPhase] = graph.phases

      const sweepItems = filterQueueCandidates(sweepPhase!, undefined, candidates)
      const waitingItems = filterQueueCandidates(waitingPhase!, undefined, candidates)

      expect(sweepItems).toHaveLength(3)
      expect(sweepItems.every(c => c.frontmatter?.status === 'inbox')).toBe(true)

      expect(waitingItems).toHaveLength(3)
      expect(waitingItems.every(c => c.frontmatter?.status === 'waiting')).toBe(true)
    })
  })

  describe('Stage progress meter and checklist guidance derivation', () => {
    function makeState(
      graph: PhaseGraph,
      currentPhaseId: string,
      visitCounts: Record<string, number>,
    ): EngineState {
      const phaseVisitCounts = Object.entries(visitCounts).reduce<Record<string, number>>(
        (acc, [key, count]) => ({
          ...acc,
          [PhaseIdSchema.parse(key)]: count,
        }),
        {},
      )

      return {
        status: 'running',
        phaseGraphId: graph.id,
        currentPhaseId: PhaseIdSchema.parse(currentPhaseId),
        remaining: Temporal.Duration.from({ minutes: 5 }),
        activeFilePath: null,
        phaseVisitCounts,
        queueExhausted: false,
        session: null,
      }
    }

    test('derives stage progress through weekly GTD review phases with accurate completion fractions', async () => {
      const graph = await loadRoutine('review-cadences/weekly-gtd-routine.md')

      // Stage 1: inbox-clear (0/5 completed)
      const stage1State = makeState(graph, 'inbox-clear', { 'inbox-clear': 1 })
      const progress1 = deriveStageProgress(graph, stage1State)
      expect(progress1.totalCount).toBe(5)
      expect(progress1.completedCount).toBe(0)
      expect(progress1.progressFraction).toBe(0)
      expect(progress1.stages[0]?.status).toBe('active')
      expect(progress1.stages[0]?.isCurrent).toBe(true)
      expect(progress1.stages[1]?.status).toBe('upcoming')

      // Stage 2: project-review (1/5 completed)
      const stage2State = makeState(graph, 'project-review', { 'inbox-clear': 1, 'project-review': 1 })
      const progress2 = deriveStageProgress(graph, stage2State)
      expect(progress2.completedCount).toBe(1)
      expect(progress2.progressFraction).toBeCloseTo(0.2, 5)
      expect(progress2.stages[0]?.status).toBe('completed')
      expect(progress2.stages[1]?.status).toBe('active')
      expect(progress2.stages[1]?.isCurrent).toBe(true)

      // Stage 3: waiting-review (2/5 completed)
      const stage3State = makeState(graph, 'waiting-review', { 'inbox-clear': 1, 'project-review': 1, 'waiting-review': 1 })
      const progress3 = deriveStageProgress(graph, stage3State)
      expect(progress3.completedCount).toBe(2)
      expect(progress3.progressFraction).toBeCloseTo(0.4, 5)
      expect(progress3.stages[0]?.status).toBe('completed')
      expect(progress3.stages[1]?.status).toBe('completed')
      expect(progress3.stages[2]?.status).toBe('active')

      // Stage 4: someday-maybe (3/5 completed)
      const stage4State = makeState(graph, 'someday-maybe', {
        'inbox-clear': 1,
        'project-review': 1,
        'waiting-review': 1,
        'someday-maybe': 1,
      })
      const progress4 = deriveStageProgress(graph, stage4State)
      expect(progress4.completedCount).toBe(3)
      expect(progress4.progressFraction).toBeCloseTo(0.6, 5)

      // Stage 5: weekly-planning (4/5 completed)
      const stage5State = makeState(graph, 'weekly-planning', {
        'inbox-clear': 1,
        'project-review': 1,
        'waiting-review': 1,
        'someday-maybe': 1,
        'weekly-planning': 1,
      })
      const progress5 = deriveStageProgress(graph, stage5State)
      expect(progress5.completedCount).toBe(4)
      expect(progress5.progressFraction).toBeCloseTo(0.8, 5)
      expect(progress5.stages[4]?.status).toBe('active')
      expect(progress5.stages[4]?.isCurrent).toBe(true)
    })
  })

  describe('Queue exhaustion and auto-advance transitions in EngineStore', () => {
    test('auto-advances from inbox-clear to project-review to waiting-review on queue exhaustion', async () => {
      const graph = await loadRoutine('review-cadences/weekly-gtd-routine.md')
      const store = new EngineStore(graph)

      await store.dispatch({ type: 'start' })
      expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('inbox-clear'))
      expect(store.getState().status).toBe('running')

      // Exhaust inbox queue -> triggers auto-advance transition to project-review (lands at stopped per reducer design)
      await store.dispatch({ type: 'set-queue-exhausted', exhausted: true })
      expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('project-review'))
      expect(store.getState().status).toBe('stopped')

      // Restart running session on project-review phase and exhaust again
      await store.dispatch({ type: 'start' })
      expect(store.getState().status).toBe('running')

      // Exhaust project queue -> triggers auto-advance transition to waiting-review
      await store.dispatch({ type: 'set-queue-exhausted', exhausted: true })
      expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('waiting-review'))
      expect(store.getState().status).toBe('stopped')

      // Restart running session on waiting-review phase and exhaust again
      await store.dispatch({ type: 'start' })
      expect(store.getState().status).toBe('running')

      // Exhaust waiting queue -> triggers auto-advance transition to someday-maybe
      await store.dispatch({ type: 'set-queue-exhausted', exhausted: true })
      expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('someday-maybe'))
      expect(store.getState().status).toBe('stopped')

      // Advance through someday-maybe -> lands in weekly-planning
      await store.dispatch({ type: 'advance-phase' })
      expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('weekly-planning'))

      // History captures sequential transitions
      const history = store.getState().session?.history ?? []
      expect(history.length).toBeGreaterThanOrEqual(4)
      expect(history[0]?.phaseId).toBe(PhaseIdSchema.parse('inbox-clear'))
      expect(history[1]?.phaseId).toBe(PhaseIdSchema.parse('project-review'))
      expect(history[2]?.phaseId).toBe(PhaseIdSchema.parse('waiting-review'))
      expect(history[3]?.phaseId).toBe(PhaseIdSchema.parse('someday-maybe'))
    })
  })

  describe('Modal safety and active routine switching prevention', () => {
    test('decideStartAction requires confirmation when switching routines during an active review session', async () => {
      const gtdGraph = await loadRoutine('review-cadences/weekly-gtd-routine.md')
      const kickoffGraph = await loadRoutine('review-cadences/daily-kickoff-routine.md')

      const runningGtdState = {
        status: 'running' as const,
        graphId: gtdGraph.id,
      }

      const action = decideStartAction(runningGtdState, kickoffGraph.id)
      expect(action).toBe('confirm')
    })

    test('decideStartAction is no-op when re-triggering already active review routine', async () => {
      const gtdGraph = await loadRoutine('review-cadences/weekly-gtd-routine.md')

      const runningGtdState = {
        status: 'running' as const,
        graphId: gtdGraph.id,
      }

      const action = decideStartAction(runningGtdState, gtdGraph.id)
      expect(action).toBe('start')
    })

    test('decideStartAction starts immediately when current routine is stopped', async () => {
      const gtdGraph = await loadRoutine('review-cadences/weekly-gtd-routine.md')
      const kickoffGraph = await loadRoutine('review-cadences/daily-kickoff-routine.md')

      const stoppedGtdState = {
        status: 'stopped' as const,
        graphId: gtdGraph.id,
      }

      const action = decideStartAction(stoppedGtdState, kickoffGraph.id)
      expect(action).toBe('start')
    })

    test('runCadenceRoutine cancels when replacement confirmation is rejected', async () => {
      const gtdGraph = await loadRoutine('review-cadences/weekly-gtd-routine.md')
      let setGraphCalled = false
      let dispatchCalled = false

      const deps = {
        readRoutineFile: async () => `\`\`\`json\n${JSON.stringify(gtdGraph)}\n\`\`\`\n`,
        getActiveRoutine: () => ({
          graphId: PhaseGraphIdSchema.parse('other-routine'),
          graphName: 'Other Routine',
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

      const rules: readonly CadenceRule[] = [
        {
          id: 'test-rule',
          routinePath: 'review-cadences/weekly-gtd-routine.md',
        },
      ]

      const result = await runCadenceRoutine(rules, { now: Temporal.Now.instant() }, deps)
      expect(result).toBe('cancelled')
      expect(setGraphCalled).toBe(false)
      expect(dispatchCalled).toBe(false)
    })

    test('runCadenceRoutine switches and starts routine when replacement confirmation is accepted', async () => {
      const gtdGraph = await loadRoutine('review-cadences/weekly-gtd-routine.md')
      let setGraphCalled = false
      let dispatchedAction = ''

      const deps = {
        readRoutineFile: async () => `\`\`\`json\n${JSON.stringify(gtdGraph)}\n\`\`\`\n`,
        getActiveRoutine: () => ({
          graphId: PhaseGraphIdSchema.parse('other-routine'),
          graphName: 'Other Routine',
          status: 'running' as const,
        }),
        confirmReplace: async () => 'confirmed' as const,
        setGraph: () => {
          setGraphCalled = true
        },
        dispatch: async (action: { type: string }) => {
          dispatchedAction = action.type
        },
        activateView: async () => {},
      }

      const rules: readonly CadenceRule[] = [
        {
          id: 'test-rule',
          routinePath: 'review-cadences/weekly-gtd-routine.md',
        },
      ]

      const result = await runCadenceRoutine(rules, { now: Temporal.Now.instant() }, deps)
      expect(result).toBe('started')
      expect(setGraphCalled).toBe(true)
      expect(dispatchedAction).toBe('start')
    })
  })
})
