import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { EngineStore } from '../src/timer/store'
import { PhaseGraphSchema, PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import { PhaseIdSchema, PhaseSchema } from '../src/domain/phase/phase'
import { POMODORO_PHASE_GRAPH } from '../src/timer/phase-graph'
import { WRITE_BACK_HOOK_NAME } from '../src/timer/write-back'
import { TaskQueueItemIdSchema, TaskSourceIdSchema } from '../src/domain/queue/task-source'
import type { TaskQueueItem, TaskSource, TaskSourceRegistry } from '../src/domain/queue/task-source'
import { HookNameSchema, HookReferenceSchema } from '../src/domain/hook/hook-reference'
import type { HookReference } from '../src/domain/hook/hook-reference'
import type { Hook, HookRegistry } from '../src/domain/hook/hook'
import type { FileMutationPort } from '../src/domain/mutation/apply-mutations'

const phaseDefaults = {
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  onEnter: null,
  onComplete: null,
  onSkip: null,
  onExit: null,
} as const

function createCounter() {
  let count = 0
  return {
    increment: () => {
      count += 1
    },
    count: () => count,
  }
}

function buildGraph(id: string, durationSeconds = 10): PhaseGraph {
  return PhaseGraphSchema.parse({
    id,
    name: `Graph ${id}`,
    phases: [
      PhaseSchema.parse({ ...phaseDefaults, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: durationSeconds }), logTarget: { kind: 'activeItem' } }),
      PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Break', kind: 'break', duration: Temporal.Duration.from({ seconds: 5 }), logTarget: { kind: 'activeItem' } }),
    ],
    transitions: [
      { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
      { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
    ],
  })
}

const exercisesTaskSourceId = TaskSourceIdSchema.parse('exercises')

function buildQueueExhaustedGraph(): PhaseGraph {
  return PhaseGraphSchema.parse({
    id: 'workout',
    name: 'Workout graph',
    phases: [
      PhaseSchema.parse({ ...phaseDefaults, id: 'set', label: 'Set', kind: 'set', duration: null, taskSourceId: exercisesTaskSourceId, logTarget: { kind: 'activeItem' } }),
      PhaseSchema.parse({ ...phaseDefaults, id: 'done', label: 'Done', kind: 'done', duration: null, logTarget: { kind: 'activeItem' } }),
    ],
    transitions: [
      { fromPhaseId: 'set', toPhaseId: 'done', condition: { kind: 'queueExhausted' } },
      { fromPhaseId: 'set', toPhaseId: 'set', condition: { kind: 'always' } },
    ],
  })
}

function buildQueueItem(id: string): TaskQueueItem {
  return {
    id: TaskQueueItemIdSchema.parse(id),
    sourcePath: `${id}.md`,
    displayName: id,
    cycleStatus: 'pending',
    timeSpent: Temporal.Duration.from({ seconds: 0 }),
    lastCycledAt: null,
  }
}

/** A mutable TaskSourceRegistry resolving `exercisesTaskSourceId` to whatever items were last set, so a test can simulate items being worked through between dispatches. */
function createFakeTaskSourceRegistry(initialItems: readonly TaskQueueItem[]) {
  let items = initialItems
  const source: TaskSource = { getQueue: () => items }
  const registry: TaskSourceRegistry = { resolve: id => (id === exercisesTaskSourceId ? source : undefined) }
  const setItems = (next: readonly TaskQueueItem[]) => {
    items = next
  }
  return { registry, setItems }
}

describe('EngineStore', () => {
  test('constructs with the initial state of the given graph', () => {
    const graph = buildGraph('a')
    const store = new EngineStore(graph)

    expect(store.getGraph()).toBe(graph)
    expect(store.getState().status).toBe('stopped')
    expect(store.getState().phaseGraphId).toBe(PhaseGraphIdSchema.parse('a'))
  })

  test('subscribe is notified after a state-changing dispatch', async () => {
    const store = new EngineStore(buildGraph('a'))
    let seen: readonly string[] = []
    store.subscribe((state) => {
      seen = [...seen, state.status]
    })

    await store.dispatch({ type: 'start' })

    expect(seen).toEqual(['running'])
  })

  test('subscribe is not notified when the reducer returns the same state reference (duration-less phase tick)', async () => {
    const manualGraph = PhaseGraphSchema.parse({
      id: 'manual',
      name: 'Manual graph',
      phases: [PhaseSchema.parse({ ...phaseDefaults, id: 'turn', label: 'Turn', kind: 'focus', duration: null, logTarget: { kind: 'activeItem' } })],
      transitions: [],
    })
    const store = new EngineStore(manualGraph)
    await store.dispatch({ type: 'start' })
    const counter = createCounter()
    store.subscribe(() => counter.increment())

    await store.dispatch({ type: 'tick' })

    expect(counter.count()).toBe(0)
  })

  test('unsubscribe stops further notifications', async () => {
    const store = new EngineStore(buildGraph('a'))
    const counter = createCounter()
    const unsubscribe = store.subscribe(() => counter.increment())

    await store.dispatch({ type: 'start' })
    unsubscribe()
    await store.dispatch({ type: 'pause' })

    expect(counter.count()).toBe(1)
  })

  test('setGraph switches the active graph and resets to its initial state', () => {
    const store = new EngineStore(buildGraph('a'))
    const graphB = buildGraph('b', 42)

    store.setGraph(graphB)

    expect(store.getGraph()).toBe(graphB)
    expect(store.getState().status).toBe('stopped')
    expect(store.getState().phaseGraphId).toBe(PhaseGraphIdSchema.parse('b'))
    expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('focus'))
    expect(store.getState().remaining?.total({ unit: 'seconds' })).toBe(42)
  })

  test('setGraph while running unconditionally resets, discarding in-progress state (documented contract)', async () => {
    const store = new EngineStore(buildGraph('a'))
    await store.dispatch({ type: 'start', filePath: 'task.md' })
    expect(store.getState().status).toBe('running')

    store.setGraph(buildGraph('b'))

    expect(store.getState().status).toBe('stopped')
    expect(store.getState().activeFilePath).toBeNull()
  })

  test('setGraph notifies subscribers', () => {
    const store = new EngineStore(buildGraph('a'))
    const counter = createCounter()
    store.subscribe(() => counter.increment())

    store.setGraph(buildGraph('b'))

    expect(counter.count()).toBe(1)
  })
})

describe('EngineStore queueExhausted sync', () => {
  test('dispatch snapshots a fresh queue-empty reading before evaluating the action, so draining the queue between dispatches changes the outcome', async () => {
    const { registry, setItems } = createFakeTaskSourceRegistry([buildQueueItem('rep-1')])
    const store = new EngineStore(buildQueueExhaustedGraph(), { taskSourceRegistry: registry })
    await store.dispatch({ type: 'start' })

    await store.dispatch({ type: 'advance-phase' })
    expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('set'))

    setItems([])
    await store.dispatch({ type: 'advance-phase' })
    expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('done'))
  })

  test('omitting taskSourceRegistry leaves queueExhausted false, so the queueExhausted branch never fires', async () => {
    const store = new EngineStore(buildQueueExhaustedGraph())
    await store.dispatch({ type: 'start' })

    await store.dispatch({ type: 'advance-phase' })

    expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('set'))
    expect(store.getState().queueExhausted).toBe(false)
  })

  test('a phase with no taskSourceId is never treated as exhausted, even with a registry supplied', async () => {
    const { registry } = createFakeTaskSourceRegistry([])
    const noQueueGraph = PhaseGraphSchema.parse({
      id: 'no-queue',
      name: 'No queue graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, id: 'warmup', label: 'Warmup', kind: 'warmup', duration: null, logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'done', label: 'Done', kind: 'done', duration: null, logTarget: { kind: 'activeItem' } }),
      ],
      transitions: [
        { fromPhaseId: 'warmup', toPhaseId: 'done', condition: { kind: 'queueExhausted' } },
        { fromPhaseId: 'warmup', toPhaseId: 'warmup', condition: { kind: 'always' } },
      ],
    })
    const store = new EngineStore(noQueueGraph, { taskSourceRegistry: registry })
    await store.dispatch({ type: 'start' })

    await store.dispatch({ type: 'advance-phase' })

    expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('warmup'))
  })
})

describe('POMODORO_PHASE_GRAPH write-back wiring', () => {
  test('every phase declares onComplete naming the write-back hook', () => {
    for (const phase of POMODORO_PHASE_GRAPH.phases) {
      expect(phase.onComplete).toEqual({ name: WRITE_BACK_HOOK_NAME, params: {} })
    }
  })
})

function hookRef(name: string): HookReference {
  return HookReferenceSchema.parse({ name: HookNameSchema.parse(name), params: {} })
}

function createNoopPort(): FileMutationPort {
  return {
    writeFrontmatter: async () => {},
    appendText: async () => {},
    reorderQueueItem: async () => {},
    changeQueueItemStatus: async () => {},
  }
}

/** Two-phase (focus -> break) graph with configurable onExit/onEnter hook references, for exercising invocation-failure isolation. */
function buildIsolationGraph(overrides: { onExit?: HookReference | null, onEnter?: HookReference | null } = {}): PhaseGraph {
  return PhaseGraphSchema.parse({
    id: 'isolation',
    name: 'Isolation graph',
    phases: [
      PhaseSchema.parse({
        ...phaseDefaults,
        id: 'focus',
        label: 'Focus',
        kind: 'focus',
        duration: Temporal.Duration.from({ seconds: 10 }),
        logTarget: { kind: 'activeItem' },
        onExit: overrides.onExit ?? null,
      }),
      PhaseSchema.parse({
        ...phaseDefaults,
        id: 'break',
        label: 'Break',
        kind: 'break',
        duration: Temporal.Duration.from({ seconds: 5 }),
        logTarget: { kind: 'activeItem' },
        onEnter: overrides.onEnter ?? null,
      }),
    ],
    transitions: [
      { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
      { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
    ],
  })
}

describe('EngineStore hook invocation isolation', () => {
  test('a throwing onExit hook does not suppress the paired onEnter hook', async () => {
    const enterHook: Hook = async () => []
    const throwingExit: Hook = () => {
      throw new Error('onExit blew up')
    }
    const registry: HookRegistry = {
      resolve: name => (name === 'exit' ? throwingExit : name === 'enter' ? enterHook : undefined),
    }
    const graph = buildIsolationGraph({ onExit: hookRef('exit'), onEnter: hookRef('enter') })
    const store = new EngineStore(graph, { hookRegistry: registry, port: createNoopPort() })

    const applications = await store.dispatch({ type: 'advance-phase' })

    expect(applications.map(a => a.event)).toEqual(['onExit', 'onEnter'])
    expect(applications[1]?.outcome).toEqual({ stage: 'applied', result: { success: true } })
  })

  test('a rejecting hook promise does not suppress a later event\'s hook in the same dispatch', async () => {
    const enterHook: Hook = async () => []
    const rejectingExit: Hook = async () => Promise.reject(new Error('onExit rejected'))
    const registry: HookRegistry = {
      resolve: name => (name === 'exit' ? rejectingExit : name === 'enter' ? enterHook : undefined),
    }
    const graph = buildIsolationGraph({ onExit: hookRef('exit'), onEnter: hookRef('enter') })
    const store = new EngineStore(graph, { hookRegistry: registry, port: createNoopPort() })

    const applications = await store.dispatch({ type: 'advance-phase' })

    expect(applications.map(a => a.event)).toEqual(['onExit', 'onEnter'])
    expect(applications[1]?.outcome).toEqual({ stage: 'applied', result: { success: true } })
  })

  test('dispatch\'s resolved result reflects a hook invocation failure without throwing', async () => {
    const throwingExit: Hook = () => {
      throw new Error('boom')
    }
    const registry: HookRegistry = { resolve: name => (name === 'exit' ? throwingExit : undefined) }
    const graph = buildIsolationGraph({ onExit: hookRef('exit') })
    const store = new EngineStore(graph, { hookRegistry: registry, port: createNoopPort() })

    const applications = await store.dispatch({ type: 'advance-phase' })

    expect(applications).toHaveLength(1)
    const exitApplication = applications[0]
    expect(exitApplication?.event).toBe('onExit')
    expect(exitApplication?.outcome.stage).toBe('invocationFailed')
    expect(exitApplication?.outcome).toEqual({ stage: 'invocationFailed', cause: expect.any(Error) })
  })
})
