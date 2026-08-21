import { mock, test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { EngineStore } from '../src/timer/store'
import { PhaseGraphSchema, checkPhaseGraphIntegrity } from '../src/domain/phase/phase-graph'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import { PhaseIdSchema, PhaseSchema } from '../src/domain/phase/phase'
import { HookNameSchema } from '../src/domain/hook/hook-reference'
import type { HookContext, HookRegistry } from '../src/domain/hook/hook'
import { FileMutationSchema } from '../src/domain/mutation/file-mutation'
import type { FileMutation } from '../src/domain/mutation/file-mutation'
import type { FileMutationPort } from '../src/domain/mutation/apply-mutations'
import type { TaskSource, TaskSourceRegistry, TaskQueueItem } from '../src/domain/queue/task-source'
import { TaskSourceIdSchema, TaskQueueItemIdSchema } from '../src/domain/queue/task-source'
import { QueueItemActionSchema } from '../src/domain/action/queue-item-action'
import type { NotificationPort } from '../src/timer/notification-port'

function createFakePort(rejections: Partial<Record<keyof FileMutationPort, unknown>> = {}) {
  let order: readonly string[] = []
  const make = (name: keyof FileMutationPort) => mock(async (_mutation: FileMutation) => {
    order = [...order, name]
    if (name in rejections) {
      throw rejections[name]
    }
  })
  const port: FileMutationPort = {
    writeFrontmatter: make('writeFrontmatter'),
    appendText: make('appendText'),
    reorderQueueItem: make('reorderQueueItem'),
    changeQueueItemStatus: make('changeQueueItemStatus'),
  }
  return { port, getOrder: () => order }
}

function createEventTracker() {
  let events: readonly string[] = []
  return {
    record: (event: string) => {
      events = [...events, event]
    },
    getEvents: () => events,
    reset: () => {
      events = []
    },
  }
}

function createFakeNotificationPort() {
  let inApp: readonly string[] = []
  let system: readonly { readonly title: string, readonly body: string }[] = []
  const notificationPort: NotificationPort = {
    notifyInApp: (message: string) => {
      inApp = [...inApp, message]
    },
    notifySystem: (title: string, body: string) => {
      system = [...system, { title, body }]
    },
  }
  return {
    notificationPort,
    getInApp: () => inApp,
    getSystem: () => system,
  }
}

describe('0.1.0 validation: Programming model and Hook API surface', () => {
  describe('PhaseGraph topology and referential integrity', () => {
    test('validates multi-step cyclic pomodoro ladder with long break branching', () => {
      const graph = PhaseGraphSchema.parse({
        id: 'pomodoro-ladder',
        name: 'Pomodoro Ladder',
        phases: [
          PhaseSchema.parse({
            id: 'focus',
            label: 'Focus',
            kind: 'focus',
            duration: Temporal.Duration.from({ minutes: 25 }),
          }),
          PhaseSchema.parse({
            id: 'short-break',
            label: 'Short Break',
            kind: 'break',
            duration: Temporal.Duration.from({ minutes: 5 }),
          }),
          PhaseSchema.parse({
            id: 'long-break',
            label: 'Long Break',
            kind: 'break',
            duration: Temporal.Duration.from({ minutes: 15 }),
          }),
        ],
        transitions: [
          { from: 'focus', to: 'long-break', guard: { kind: 'everyNth', count: 4 } },
          { from: 'focus', to: 'short-break', guard: { kind: 'always' } },
          { from: 'short-break', to: 'focus', guard: { kind: 'always' } },
          { from: 'long-break', to: 'focus', guard: { kind: 'always' } },
        ],
      })

      expect(checkPhaseGraphIntegrity(graph)).toEqual([])
      expect(graph.phases).toHaveLength(3)
      expect(graph.transitions).toHaveLength(4)
    })

    test('detects dangling transition references and duplicate phase IDs', () => {
      const brokenGraph: PhaseGraph = PhaseGraphSchema.parse({
        id: 'broken',
        name: 'Broken Graph',
        phases: [
          PhaseSchema.parse({ id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }) }),
          PhaseSchema.parse({ id: 'focus', label: 'Duplicate Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }) }),
        ],
        transitions: [
          { from: 'focus', to: 'ghost-phase', guard: { kind: 'always' } },
          { from: 'missing-phase', to: 'focus', guard: { kind: 'always' } },
        ],
      })

      const issues = checkPhaseGraphIntegrity(brokenGraph)
      expect(issues.some(i => i.message.includes('declared more than once'))).toBe(true)
      expect(issues.some(i => i.message.includes('"ghost-phase"'))).toBe(true)
      expect(issues.some(i => i.message.includes('"missing-phase"'))).toBe(true)
    })

    test('accepts valid linear pipeline ending in a terminal node', () => {
      const pipelineGraph: PhaseGraph = PhaseGraphSchema.parse({
        id: 'linear-pipeline',
        name: 'Linear Pipeline',
        phases: [
          PhaseSchema.parse({ id: 'warmup', label: 'Warm-up', kind: 'focus', duration: Temporal.Duration.from({ seconds: 5 }) }),
          PhaseSchema.parse({ id: 'main', label: 'Main Workout', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }) }),
          PhaseSchema.parse({ id: 'cooldown', label: 'Cool-down', kind: 'focus', duration: Temporal.Duration.from({ seconds: 5 }) }),
        ],
        transitions: [
          { from: 'warmup', to: 'main', guard: { kind: 'always' } },
          { from: 'main', to: 'cooldown', guard: { kind: 'always' } },
        ],
      })

      expect(checkPhaseGraphIntegrity(pipelineGraph)).toEqual([])
    })
  })

  describe('Hook and HookRegistry lifecycle execution', () => {
    test('executes full lifecycle events in strict deterministic order across phase transitions', async () => {
      const tracker = createEventTracker()
      const hookRegistry: HookRegistry = {
        resolve: (name) => {
          return async (context: HookContext) => {
            tracker.record(`${String(name)}:${context.phase.id}`)
            return []
          }
        },
      }

      const graph = PhaseGraphSchema.parse({
        id: 'lifecycle-test',
        name: 'Lifecycle Test',
        phases: [
          PhaseSchema.parse({
            id: 'phase-1',
            label: 'Phase 1',
            kind: 'focus',
            duration: Temporal.Duration.from({ seconds: 1 }),
            handlers: {
              onEnter: [{ kind: 'script', scriptPath: 'hook-enter-1' }],
              onComplete: [{ kind: 'script', scriptPath: 'hook-complete-1' }],
              onSkip: [{ kind: 'script', scriptPath: 'hook-skip-1' }],
              onExit: [{ kind: 'script', scriptPath: 'hook-exit-1' }],
            },
          }),
          PhaseSchema.parse({
            id: 'phase-2',
            label: 'Phase 2',
            kind: 'break',
            duration: Temporal.Duration.from({ seconds: 2 }),
            handlers: {
              onEnter: [{ kind: 'script', scriptPath: 'hook-enter-2' }],
              onComplete: [{ kind: 'script', scriptPath: 'hook-complete-2' }],
              onSkip: [{ kind: 'script', scriptPath: 'hook-skip-2' }],
              onExit: [{ kind: 'script', scriptPath: 'hook-exit-2' }],
            },
          }),
        ],
        transitions: [
          { from: 'phase-1', to: 'phase-2', guard: { kind: 'always' } },
          { from: 'phase-2', to: 'phase-1', guard: { kind: 'always' } },
        ],
      })

      const { port } = createFakePort()
      const store = new EngineStore(graph, { hookRegistry, port })

      // 1. Start session
      await store.dispatch({ type: 'start' })
      expect(store.getState().status).toBe('running')
      expect(tracker.getEvents()).toEqual([]) // Session opening does not trigger transition hook events

      // 2. Auto-complete phase-1 via tick countdown -> onComplete(phase-1), onExit(phase-1), onEnter(phase-2)
      await store.dispatch({ type: 'tick' }) // 1s -> 0s
      await store.dispatch({ type: 'tick' }) // 0s -> auto-advance
      expect(tracker.getEvents()).toEqual([
        'hook-complete-1:phase-1',
        'hook-exit-1:phase-1',
        'hook-enter-2:phase-2',
      ])
      tracker.reset()

      // 3. Start running phase-2, then skip it -> onSkip(phase-2), onExit(phase-2), onEnter(phase-1)
      await store.dispatch({ type: 'start' })
      await store.dispatch({ type: 'advance-phase' })
      expect(tracker.getEvents()).toEqual([
        'hook-skip-2:phase-2',
        'hook-exit-2:phase-2',
        'hook-enter-1:phase-1',
      ])
      tracker.reset()

      // 4. Start running phase-1, then stop session -> onExit(phase-1) with abandoned reason
      await store.dispatch({ type: 'start' })
      await store.dispatch({ type: 'stop' })
      expect(tracker.getEvents()).toEqual(['hook-exit-1:phase-1'])
    })

    test('preset handlers generate expected mutations and notifications on completion and entry', async () => {
      const { notificationPort, getInApp, getSystem } = createFakeNotificationPort()
      const { port } = createFakePort()

      const graph = PhaseGraphSchema.parse({
        id: 'preset-handlers-test',
        name: 'Preset Handlers Test',
        phases: [
          PhaseSchema.parse({
            id: 'focus',
            label: 'Focus',
            kind: 'focus',
            duration: Temporal.Duration.from({ seconds: 1 }),
            handlers: {
              onComplete: [
                { kind: 'preset', preset: 'markDone' },
                { kind: 'preset', preset: 'setFrontmatter', params: { property: 'sessions', value: 1 } },
              ],
              onExit: [
                { kind: 'preset', preset: 'queueCycle' },
              ],
            },
          }),
          PhaseSchema.parse({
            id: 'break',
            label: 'Break',
            kind: 'break',
            duration: Temporal.Duration.from({ seconds: 1 }),
            notification: {
              sound: 'bell',
              systemNotification: true,
            },
            handlers: {
              onEnter: [
                { kind: 'preset', preset: 'notify', params: { title: 'Break Time', body: 'Rest well!', system: true } },
              ],
            },
          }),
        ],
        transitions: [
          { from: 'focus', to: 'break', guard: { kind: 'always' } },
        ],
      })

      const store = new EngineStore(graph, { port, notificationPort })

      // Start with active file path
      await store.dispatch({ type: 'start', filePath: 'notes/task-1.md' })

      // Tick to completion -> auto-advances to break, firing onComplete, onExit, onEnter
      await store.dispatch({ type: 'tick' }) // 1s -> 0s
      await store.dispatch({ type: 'tick' }) // 0s -> advance

      // Check onComplete and onExit effects from focus phase
      expect(port.changeQueueItemStatus).toHaveBeenCalledWith(FileMutationSchema.parse({
        kind: 'queueStatusChange',
        itemId: 'notes/task-1.md',
        status: 'done',
      }))
      expect(port.writeFrontmatter).toHaveBeenCalledWith(FileMutationSchema.parse({
        kind: 'frontmatter',
        filePath: 'notes/task-1.md',
        property: 'sessions',
        value: 1,
      }))
      expect(port.reorderQueueItem).toHaveBeenCalledWith(FileMutationSchema.parse({
        kind: 'queueReorder',
        itemId: 'notes/task-1.md',
        position: 'back',
      }))

      // Check onEnter notification handler effect
      expect(getInApp()).toContain('Rest well!')
      expect(getSystem()).toContainEqual({ title: 'Break Time', body: 'Rest well!' })
    })

    test('isolates hook exceptions and records outcome without crashing engine', async () => {
      const hookRegistry: HookRegistry = {
        resolve: (name) => {
          if (name === HookNameSchema.parse('failing-hook')) {
            return async () => {
              throw new Error('Script execution error')
            }
          }
          return async () => []
        },
      }

      const graph = PhaseGraphSchema.parse({
        id: 'failing-hook-test',
        name: 'Failing Hook Test',
        phases: [
          PhaseSchema.parse({
            id: 'phase-1',
            label: 'Phase 1',
            kind: 'focus',
            duration: Temporal.Duration.from({ seconds: 1 }),
            handlers: {
              onComplete: [{ kind: 'script', scriptPath: 'failing-hook' }],
            },
          }),
          PhaseSchema.parse({
            id: 'phase-2',
            label: 'Phase 2',
            kind: 'break',
            duration: Temporal.Duration.from({ seconds: 1 }),
          }),
        ],
        transitions: [
          { from: 'phase-1', to: 'phase-2', guard: { kind: 'always' } },
        ],
      })

      const { port } = createFakePort()
      const store = new EngineStore(graph, { hookRegistry, port })

      await store.dispatch({ type: 'start' })
      const apps = await store.dispatch({ type: 'finish-phase' })

      expect(apps).toHaveLength(1)
      expect(apps[0]?.outcome.stage).toBe('invocationFailed')
      expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('phase-2'))

      // Session history captures hook failures
      const lastClosed = store.getState().session?.history.at(-1)
      expect(lastClosed?.hookFailures).toHaveLength(1)
      expect(lastClosed?.hookFailures[0]?.event).toBe('onComplete')
    })
  })

  describe('CompletionPolicy handling', () => {
    test('waitForManual policy halts at completed and awaits manual clear', async () => {
      const tracker = createEventTracker()
      const hookRegistry: HookRegistry = {
        resolve: name => async (ctx) => {
          tracker.record(`${String(name)}:${ctx.phase.id}`)
          return []
        },
      }

      const manualGraph = PhaseGraphSchema.parse({
        id: 'manual-policy-test',
        name: 'Manual Policy Test',
        phases: [
          PhaseSchema.parse({
            id: 'reps',
            label: 'Reps Set',
            kind: 'focus',
            duration: Temporal.Duration.from({ seconds: 1 }),
            onCompletion: 'waitForManual',
            handlers: {
              onComplete: [{ kind: 'script', scriptPath: 'completed' }],
              onExit: [{ kind: 'script', scriptPath: 'exited' }],
            },
          }),
          PhaseSchema.parse({
            id: 'rest',
            label: 'Rest',
            kind: 'break',
            duration: Temporal.Duration.from({ seconds: 5 }),
          }),
        ],
        transitions: [
          { from: 'reps', to: 'rest', guard: { kind: 'always' } },
        ],
      })

      const { port } = createFakePort()
      const store = new EngineStore(manualGraph, { hookRegistry, port })

      await store.dispatch({ type: 'start' })
      await store.dispatch({ type: 'tick' }) // 1s -> 0s
      await store.dispatch({ type: 'tick' }) // halts at status: 'completed'

      expect(store.getState().status).toBe('completed')
      expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('reps'))
      expect(tracker.getEvents()).toEqual(['completed:reps'])
      tracker.reset()

      // Manual advance clears and transitions to rest
      await store.dispatch({ type: 'advance-phase' })

      expect(store.getState().status).toBe('stopped')
      expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('rest'))
      expect(tracker.getEvents()).toEqual(['exited:reps'])

      // Closed instance marked with endReason 'completed'
      const closedInstance = store.getState().session?.history.at(-1)
      expect(closedInstance?.endReason).toBe('completed')
    })

    test('manual finish on duration-less phase advances naturally', async () => {
      const repGraph = PhaseGraphSchema.parse({
        id: 'durationless-test',
        name: 'Durationless Test',
        phases: [
          PhaseSchema.parse({
            id: 'exercise',
            label: 'Exercise',
            kind: 'focus',
            duration: null,
          }),
          PhaseSchema.parse({
            id: 'stretch',
            label: 'Stretch',
            kind: 'break',
            duration: Temporal.Duration.from({ seconds: 30 }),
          }),
        ],
        transitions: [
          { from: 'exercise', to: 'stretch', guard: { kind: 'always' } },
        ],
      })

      const store = new EngineStore(repGraph)
      await store.dispatch({ type: 'start' })
      expect(store.getState().remaining).toBeNull()

      await store.dispatch({ type: 'finish-phase' })
      expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('stretch'))
      expect(store.getState().remaining?.total({ unit: 'seconds' })).toBe(30)
    })
  })

  describe('FileMutation derivation and QueueItemAction execution', () => {
    test('executes frontmatter and queue status actions on active task', async () => {
      const { port } = createFakePort()
      const graph = PhaseGraphSchema.parse({
        id: 'action-test',
        name: 'Action Test',
        phases: [
          PhaseSchema.parse({
            id: 'focus',
            label: 'Focus',
            kind: 'focus',
            duration: Temporal.Duration.from({ minutes: 25 }),
            actions: [
              { id: 'done', label: 'Done', payload: { kind: 'markDone' } },
              { id: 'cycle', label: 'Cycle to back', payload: { kind: 'queueCycle' } },
              { id: 'defer', label: 'Defer 1 day', payload: { kind: 'deferDuration', after: Temporal.Duration.from({ days: 1 }) } },
              { id: 'p1', label: 'Set P1', payload: { kind: 'setFrontmatter', property: 'priority', value: 1 } },
            ],
          }),
        ],
        transitions: [],
      })

      const store = new EngineStore(graph, { port })
      await store.dispatch({ type: 'start', filePath: 'tasks/task-1.md' })

      // Execute markDone action
      const doneAction = QueueItemActionSchema.parse({ id: 'done', label: 'Done', payload: { kind: 'markDone' } })
      const doneResult = await store.executeAction(doneAction)
      expect(doneResult?.success).toBe(true)
      expect(port.changeQueueItemStatus).toHaveBeenCalledWith(FileMutationSchema.parse({
        kind: 'queueStatusChange',
        itemId: 'tasks/task-1.md',
        status: 'done',
      }))

      // Execute deferDuration action
      const deferAction = QueueItemActionSchema.parse({ id: 'defer', label: 'Defer 1 day', payload: { kind: 'deferDuration', after: Temporal.Duration.from({ days: 1 }) } })
      const deferResult = await store.executeAction(deferAction)
      expect(deferResult?.success).toBe(true)
      expect(port.changeQueueItemStatus).toHaveBeenCalledWith(FileMutationSchema.parse({
        kind: 'queueStatusChange',
        itemId: 'tasks/task-1.md',
        status: 'deferred',
      }))
      expect(port.writeFrontmatter).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'frontmatter',
        filePath: 'tasks/task-1.md',
        property: 'routine-due',
      }))
    })
  })

  describe('TaskSource dynamic queue and queueExhausted routing', () => {
    test('routes to wrapup when task source queue is exhausted', async () => {
      let currentQueue: readonly TaskQueueItem[] = [
        {
          id: TaskQueueItemIdSchema.parse('tasks/todo-1.md'),
          sourcePath: 'tasks/todo-1.md',
          displayName: 'Todo 1',
          cycleStatus: 'pending',
          timeSpent: Temporal.Duration.from({ seconds: 0 }),
          lastCycledAt: null,
        },
      ]

      const taskSource: TaskSource = {
        getQueue: () => currentQueue,
      }

      const taskSourceRegistry: TaskSourceRegistry = {
        resolve: id => (id === TaskSourceIdSchema.parse('tasks-query') ? taskSource : undefined),
      }

      const graph = PhaseGraphSchema.parse({
        id: 'queue-branching-routine',
        name: 'Queue Branching Routine',
        phases: [
          PhaseSchema.parse({
            id: 'task-processing',
            label: 'Process Task',
            kind: 'focus',
            duration: Temporal.Duration.from({ seconds: 1 }),
            taskSourceId: 'tasks-query',
          }),
          PhaseSchema.parse({
            id: 'wrapup',
            label: 'Wrap-up & Review',
            kind: 'focus',
            duration: Temporal.Duration.from({ seconds: 5 }),
          }),
        ],
        transitions: [
          { from: 'task-processing', to: 'wrapup', guard: { kind: 'queueExhausted' } },
          { from: 'task-processing', to: 'task-processing', guard: { kind: 'always' } },
        ],
      })

      const { port } = createFakePort()
      const store = new EngineStore(graph, { taskSourceRegistry, port })

      // First run: queue has 1 item -> loops back to task-processing
      await store.dispatch({ type: 'start', filePath: 'tasks/todo-1.md' })
      await store.dispatch({ type: 'finish-phase' })
      expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('task-processing'))

      // Queue is now empty
      currentQueue = []

      // Second run: queue is exhausted -> routes to wrapup
      await store.dispatch({ type: 'finish-phase' })
      expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('wrapup'))
    })

    test('records item touch on phase instance during task interaction', async () => {
      const taskQueue: readonly TaskQueueItem[] = [
        {
          id: TaskQueueItemIdSchema.parse('tasks/todo-1.md'),
          sourcePath: 'tasks/todo-1.md',
          displayName: 'Todo 1',
          cycleStatus: 'pending',
          timeSpent: Temporal.Duration.from({ seconds: 0 }),
          lastCycledAt: null,
        },
      ]

      const taskSourceRegistry: TaskSourceRegistry = {
        resolve: () => ({ getQueue: () => taskQueue }),
      }

      const graph = PhaseGraphSchema.parse({
        id: 'touch-test',
        name: 'Touch Test',
        phases: [
          PhaseSchema.parse({
            id: 'focus',
            label: 'Focus',
            kind: 'focus',
            duration: Temporal.Duration.from({ minutes: 25 }),
            taskSourceId: 'query-1',
          }),
        ],
        transitions: [],
      })

      const store = new EngineStore(graph, { taskSourceRegistry })
      await store.dispatch({ type: 'start', filePath: 'tasks/todo-1.md' })

      const currentInstance = store.getState().session?.currentInstance
      expect(currentInstance?.itemsTouched).toHaveLength(1)
      expect(currentInstance?.itemsTouched[0]?.id).toBe(TaskQueueItemIdSchema.parse('tasks/todo-1.md'))
    })
  })
})
