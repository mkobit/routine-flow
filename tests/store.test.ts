import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { EngineStore } from '../src/timer/store'
import { PhaseGraphSchema, PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import { PhaseIdSchema, PhaseSchema } from '../src/domain/phase/phase'
import { DEFAULT_PHASE_GRAPH } from '../src/timer/phase-graph'
import { WRITE_BACK_HOOK_NAME } from '../src/timer/write-back'
import { TaskQueueItemIdSchema, TaskSourceIdSchema } from '../src/domain/queue/task-source'
import type { TaskQueueItem, TaskSource, TaskSourceRegistry } from '../src/domain/queue/task-source'
import { HookNameSchema, HookReferenceSchema } from '../src/domain/hook/hook-reference'
import type { HookReference } from '../src/domain/hook/hook-reference'
import type { Hook, HookRegistry } from '../src/domain/hook/hook'
import type { FileMutationPort } from '../src/domain/mutation/apply-mutations'
import { FileMutationSchema } from '../src/domain/mutation/file-mutation'
import type { FileMutation } from '../src/domain/mutation/file-mutation'
import { QueueItemActionSchema } from '../src/domain/action/queue-item-action'

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

describe('EngineStore item-touch snapshotting', () => {
  test('activating a queue item appends a lightweight snapshot to itemsTouched', async () => {
    const item = buildQueueItem('rep-1')
    const { registry } = createFakeTaskSourceRegistry([item])
    const store = new EngineStore(buildQueueExhaustedGraph(), { taskSourceRegistry: registry })

    await store.dispatch({ type: 'start' })
    await store.dispatch({ type: 'set-active-file', filePath: 'rep-1.md' })

    expect(store.getState().session?.currentInstance?.itemsTouched).toEqual([
      { id: item.id, sourcePath: item.sourcePath, displayName: item.displayName },
    ])
  })

  test('a later change to that item\'s mutable fields doesn\'t alter the recorded snapshot', async () => {
    const item = buildQueueItem('rep-1')
    const { registry, setItems } = createFakeTaskSourceRegistry([item])
    const store = new EngineStore(buildQueueExhaustedGraph(), { taskSourceRegistry: registry })

    await store.dispatch({ type: 'start' })
    await store.dispatch({ type: 'set-active-file', filePath: 'rep-1.md' })

    setItems([{ ...item, cycleStatus: 'done', timeSpent: Temporal.Duration.from({ seconds: 60 }) }])
    await store.dispatch({ type: 'tick' }) // any later dispatch re-runs syncItemTouch against the mutated item

    expect(store.getState().session?.currentInstance?.itemsTouched).toEqual([
      { id: item.id, sourcePath: item.sourcePath, displayName: item.displayName },
    ])
  })
})

describe('DEFAULT_PHASE_GRAPH write-back wiring', () => {
  test('every phase declares onComplete naming the write-back hook', () => {
    for (const phase of DEFAULT_PHASE_GRAPH.phases) {
      expect(phase.onComplete).toEqual({ name: WRITE_BACK_HOOK_NAME, params: {} })
    }
  })

  test('every phase targets activeItem -- no phase references an unregistered callback resolver', () => {
    for (const phase of DEFAULT_PHASE_GRAPH.phases) {
      expect(phase.logTarget).toEqual({ kind: 'activeItem' })
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

/** Two-phase (focus -> break) graph with configurable onComplete/onExit/onEnter hook references, for exercising invocation-failure isolation and hook-outcome folding. */
function buildIsolationGraph(overrides: { onComplete?: HookReference | null, onExit?: HookReference | null, onEnter?: HookReference | null } = {}): PhaseGraph {
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
        onComplete: overrides.onComplete ?? null,
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
    await store.dispatch({ type: 'start' })

    const applications = await store.dispatch({ type: 'advance-phase' })

    expect(applications.map(a => a.event)).toEqual(['onExit', 'onEnter'])
    expect(applications[1]?.outcome).toEqual({ stage: 'applied', mutations: [], result: { success: true } })
  })

  test('a rejecting hook promise does not suppress a later event\'s hook in the same dispatch', async () => {
    const enterHook: Hook = async () => []
    const rejectingExit: Hook = async () => Promise.reject(new Error('onExit rejected'))
    const registry: HookRegistry = {
      resolve: name => (name === 'exit' ? rejectingExit : name === 'enter' ? enterHook : undefined),
    }
    const graph = buildIsolationGraph({ onExit: hookRef('exit'), onEnter: hookRef('enter') })
    const store = new EngineStore(graph, { hookRegistry: registry, port: createNoopPort() })
    await store.dispatch({ type: 'start' })

    const applications = await store.dispatch({ type: 'advance-phase' })

    expect(applications.map(a => a.event)).toEqual(['onExit', 'onEnter'])
    expect(applications[1]?.outcome).toEqual({ stage: 'applied', mutations: [], result: { success: true } })
  })

  test('dispatch\'s resolved result reflects a hook invocation failure without throwing', async () => {
    const throwingExit: Hook = () => {
      throw new Error('boom')
    }
    const registry: HookRegistry = { resolve: name => (name === 'exit' ? throwingExit : undefined) }
    const graph = buildIsolationGraph({ onExit: hookRef('exit') })
    const store = new EngineStore(graph, { hookRegistry: registry, port: createNoopPort() })
    await store.dispatch({ type: 'start' })

    const applications = await store.dispatch({ type: 'advance-phase' })

    expect(applications).toHaveLength(1)
    const exitApplication = applications[0]
    expect(exitApplication?.event).toBe('onExit')
    expect(exitApplication?.outcome.stage).toBe('invocationFailed')
    expect(exitApplication?.outcome).toEqual({ stage: 'invocationFailed', cause: expect.any(Error) })
  })
})

function appendMutation(text: string): FileMutation {
  return FileMutationSchema.parse({ kind: 'append', filePath: 'daily-note.md', text })
}

function frontmatterMutation(property: string): FileMutation {
  return FileMutationSchema.parse({ kind: 'frontmatter', filePath: 'task.md', property, value: true })
}

/** A manualClear-policy focus phase (onComplete/onExit configurable) followed by a plain break phase. */
function buildManualClearGraph(overrides: { onComplete?: HookReference | null, onExit?: HookReference | null } = {}): PhaseGraph {
  return PhaseGraphSchema.parse({
    id: 'manual-clear',
    name: 'Manual clear graph',
    phases: [
      PhaseSchema.parse({
        ...phaseDefaults,
        id: 'focus',
        label: 'Focus',
        kind: 'focus',
        duration: Temporal.Duration.from({ seconds: 10 }),
        logTarget: { kind: 'activeItem' },
        completionPolicy: { kind: 'manualClear' },
        onComplete: overrides.onComplete ?? null,
        onExit: overrides.onExit ?? null,
      }),
      PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Break', kind: 'break', duration: Temporal.Duration.from({ seconds: 5 }), logTarget: { kind: 'activeItem' } }),
    ],
    transitions: [
      { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
      { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
    ],
  })
}

describe('EngineStore hook-outcome folding', () => {
  test('onEnter\'s outcome accumulates onto the newly-opened currentInstance', async () => {
    const mutation = appendMutation('entered break')
    const enterHook: Hook = async () => [mutation]
    const registry: HookRegistry = { resolve: name => (name === 'enter' ? enterHook : undefined) }
    const graph = buildIsolationGraph({ onEnter: hookRef('enter') })
    const store = new EngineStore(graph, { hookRegistry: registry, port: createNoopPort() })
    await store.dispatch({ type: 'start' })

    await store.dispatch({ type: 'advance-phase' })

    expect(store.getState().session?.currentInstance?.phaseId).toBe(PhaseIdSchema.parse('break'))
    expect(store.getState().session?.currentInstance?.mutationsApplied).toEqual([mutation])
  })

  test('onComplete and onExit both firing in one dispatch accumulate onto the same closed instance, in firing order', async () => {
    const completeMutation = appendMutation('completed focus')
    const exitMutation = appendMutation('exited focus')
    const completeHook: Hook = async () => [completeMutation]
    const exitHook: Hook = async () => [exitMutation]
    const registry: HookRegistry = {
      resolve: name => (name === 'complete' ? completeHook : name === 'exit' ? exitHook : undefined),
    }
    const graph = buildIsolationGraph({ onComplete: hookRef('complete'), onExit: hookRef('exit') })
    const store = new EngineStore(graph, { hookRegistry: registry, port: createNoopPort() })
    await store.dispatch({ type: 'start' })

    await store.dispatch({ type: 'finish-phase' })

    const closed = store.getState().session?.history.at(-1)
    expect(closed?.phaseId).toBe(PhaseIdSchema.parse('focus'))
    expect(closed?.mutationsApplied).toEqual([completeMutation, exitMutation])
  })

  test('a manualClear phase\'s onComplete outcome lands on currentInstance, and its later onExit accumulates onto the same instance once closed', async () => {
    const completeMutation = appendMutation('completed focus')
    const exitMutation = appendMutation('exited focus')
    const completeHook: Hook = async () => [completeMutation]
    const exitHook: Hook = async () => [exitMutation]
    const registry: HookRegistry = {
      resolve: name => (name === 'complete' ? completeHook : name === 'exit' ? exitHook : undefined),
    }
    const graph = buildManualClearGraph({ onComplete: hookRef('complete'), onExit: hookRef('exit') })
    const store = new EngineStore(graph, { hookRegistry: registry, port: createNoopPort() })
    await store.dispatch({ type: 'start' })
    const openInstanceId = store.getState().session?.currentInstance?.id

    await store.dispatch({ type: 'finish-phase' })

    // The instance is still open (manualClear halts, doesn't close) -- onComplete's outcome landed on currentInstance, not history.
    expect(store.getState().status).toBe('completed')
    expect(store.getState().session?.history).toEqual([])
    expect(store.getState().session?.currentInstance?.id).toBe(openInstanceId)
    expect(store.getState().session?.currentInstance?.mutationsApplied).toEqual([completeMutation])

    await store.dispatch({ type: 'advance-phase' })

    const closed = store.getState().session?.history.at(-1)
    expect(closed?.id).toBe(openInstanceId)
    expect(closed?.mutationsApplied).toEqual([completeMutation, exitMutation])
  })

  test('an invocationFailed outcome is recorded in hookFailures, leaving mutationsApplied unchanged', async () => {
    const throwingExit: Hook = () => {
      throw new Error('onExit blew up')
    }
    const registry: HookRegistry = { resolve: name => (name === 'exit' ? throwingExit : undefined) }
    const graph = buildIsolationGraph({ onExit: hookRef('exit') })
    const store = new EngineStore(graph, { hookRegistry: registry, port: createNoopPort() })
    await store.dispatch({ type: 'start' })

    await store.dispatch({ type: 'advance-phase' })

    const closed = store.getState().session?.history.at(-1)
    expect(closed?.mutationsApplied).toEqual([])
    expect(closed?.hookFailures).toEqual([{ event: 'onExit', kind: 'invocationFailed', cause: expect.any(Error) }])
  })

  test('a partial mutation-apply failure records the successful prefix in mutationsApplied and the failure in hookFailures', async () => {
    const succeeding = appendMutation('this one writes')
    const failing = frontmatterMutation('sessions')
    const exitHook: Hook = async () => [succeeding, failing]
    const registry: HookRegistry = { resolve: name => (name === 'exit' ? exitHook : undefined) }
    const graph = buildIsolationGraph({ onExit: hookRef('exit') })
    const failingPort: FileMutationPort = {
      ...createNoopPort(),
      writeFrontmatter: async () => {
        throw new Error('frontmatter write failed')
      },
    }
    const store = new EngineStore(graph, { hookRegistry: registry, port: failingPort })
    await store.dispatch({ type: 'start' })

    await store.dispatch({ type: 'advance-phase' })

    const closed = store.getState().session?.history.at(-1)
    expect(closed?.mutationsApplied).toEqual([succeeding])
    expect(closed?.hookFailures).toEqual([{ event: 'onExit', kind: 'mutationFailed', mutation: failing, cause: expect.any(Error) }])
  })

  test('a stop mid-phase\'s onExit outcome does not throw, and there is no PhaseInstance left to fold it onto', async () => {
    const exitHook: Hook = async () => [appendMutation('exiting via stop')]
    const registry: HookRegistry = { resolve: name => (name === 'exit' ? exitHook : undefined) }
    const graph = buildIsolationGraph({ onExit: hookRef('exit') })
    const store = new EngineStore(graph, { hookRegistry: registry, port: createNoopPort() })
    await store.dispatch({ type: 'start' })

    const applications = await store.dispatch({ type: 'stop' })

    expect(applications.map(a => a.event)).toEqual(['onExit'])
    expect(applications[0]?.outcome.stage).toBe('applied')
    expect(store.getState().session).toBeNull()
  })
})

describe('EngineStore action execution', () => {
  test('returns null when activeFilePath is null or port is undefined', async () => {
    const action = QueueItemActionSchema.parse({
      id: 'mark-done',
      label: 'Done',
      payload: { kind: 'markDone' },
    })
    const storeWithoutPort = new EngineStore(buildGraph('a'))
    expect(await storeWithoutPort.executeAction(action)).toBeNull()

    const port = createNoopPort()
    const storeWithPort = new EngineStore(buildGraph('a'), { port })
    expect(await storeWithPort.executeAction(action)).toBeNull()
  })

  test('derives mutations and applies them via FileMutationPort when activeFilePath is set', async () => {
    const action = QueueItemActionSchema.parse({
      id: 'custom-priority',
      label: 'Priority 1',
      style: 'primary',
      payload: { kind: 'setFrontmatter', property: 'priority', value: 1 },
    })
    let mutationsApplied: readonly FileMutation[] = []
    const port: FileMutationPort = {
      ...createNoopPort(),
      writeFrontmatter: async (mutation) => {
        mutationsApplied = [...mutationsApplied, mutation]
      },
    }
    const store = new EngineStore(buildGraph('a'), { port })
    await store.dispatch({ type: 'start', filePath: 'tasks/item-1.md' })

    const result = await store.executeAction(action)

    expect(result).toEqual({ success: true })
    expect(mutationsApplied).toEqual([
      { kind: 'frontmatter', filePath: 'tasks/item-1.md', property: 'priority', value: 1 },
    ])
  })
})
