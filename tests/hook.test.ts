import { describe, expect, mock, test } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { HandlerSchema, PresetHandlerNameSchema } from '../src/domain/handler/handler'
import type { HookContext, HookRegistry } from '../src/domain/hook/hook'
import { HookNameSchema } from '../src/domain/hook/hook-reference'
import { PredicateNameSchema } from '../src/domain/hook/predicate'
import type { LogTargetResolver, LogTargetResolverRegistry } from '../src/domain/log-target/log-target-resolver'
import type { FileMutationPort } from '../src/domain/mutation/apply-mutations'
import type { FileMutation } from '../src/domain/mutation/file-mutation'
import type { FrontmatterReader } from '../src/domain/mutation/frontmatter-reader'
import { LogTargetResolverNameSchema, PhaseIdSchema, PhaseNodeSchema, PhaseSchema } from '../src/domain/phase/phase'
import type { Phase } from '../src/domain/phase/phase'
import { PhaseGraphIdSchema, PhaseGraphSchema } from '../src/domain/phase/phase-graph'
import { TaskQueueItemIdSchema, TaskSourceIdSchema } from '../src/domain/queue/task-source'
import type { TaskQueueItem, TaskSource, TaskSourceRegistry } from '../src/domain/queue/task-source'
import { PhaseInstanceIdSchema, SessionIdSchema } from '../src/domain/session/session'
import { ACCUMULATOR_HOOK_NAME, createAccumulatorHook } from '../src/timer/accumulator'
import type { AccumulatorHookDeps } from '../src/timer/accumulator'
import { createFormulaPredicateRegistry } from '../src/timer/formula-predicate-registry'
import { executeHandler } from '../src/timer/handler-executor'
import type { HandlerContext } from '../src/timer/handler-executor'
import { EngineStore } from '../src/timer/store'

const taskSourceId = TaskSourceIdSchema.parse('star-tasks')

const focusPhase: Phase = PhaseSchema.parse({
  id: 'focus',
  name: 'Focus',
  label: 'Focus',
  kind: 'focus',
  duration: Temporal.Duration.from({ minutes: 25 }),
  taskSourceId,
  logTarget: { kind: 'activeItem' },
})

const untargetedPhase: Phase = PhaseNodeSchema.parse({
  id: 'reward',
  name: 'Reward break',
  label: 'Reward break',
  kind: 'break',
  duration: Temporal.Duration.from({ minutes: 15 }),
  taskSourceId: null,
  logTarget: null,
})

const callbackPhase: Phase = PhaseNodeSchema.parse({
  id: 'focus-callback',
  name: 'Focus callback',
  label: 'Focus callback',
  kind: 'focus',
  duration: Temporal.Duration.from({ minutes: 25 }),
  taskSourceId,
  logTarget: { kind: 'callback', name: 'starJarNote' },
})

function buildHookContext(
  phase: Phase = focusPhase,
  activeFilePath: string | null = 'tasks/task-1.md',
  params: Readonly<Record<string, unknown>> = {},
): HookContext {
  const now = Temporal.Instant.from('2026-10-20T12:00:00Z')
  return {
    phase,
    activeFilePath,
    params,
    instance: {
      id: PhaseInstanceIdSchema.parse('inst-1'),
      phaseId: phase.id,
      phaseDisplayName: phase.label,
      phaseKind: phase.kind,
      plannedDuration: phase.duration,
      actualDuration: Temporal.Duration.from({ seconds: 1500 }),
      startedAt: now,
      endedAt: now,
      endReason: 'completed',
      itemsTouched: [],
      mutationsApplied: [],
      hookFailures: [],
    },
    session: {
      id: SessionIdSchema.parse('sess-1'),
      phaseGraphId: PhaseGraphIdSchema.parse('star-jar'),
      startedAt: now,
      endedAt: null,
      currentInstance: null,
      history: [],
    },
  }
}

function createFakeReader(
  files: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {},
): FrontmatterReader {
  return {
    readValue: mock((filePath: string, property: string) => files[filePath]?.[property]),
    readAll: mock((filePath: string) => files[filePath] ?? null),
  }
}

function createTaskItem(
  sourcePath: string,
  extraProperties?: Readonly<Record<string, unknown>>,
): TaskQueueItem {
  return {
    id: TaskQueueItemIdSchema.parse(sourcePath),
    sourcePath,
    displayName: sourcePath,
    cycleStatus: 'active',
    timeSpent: Temporal.Duration.from({ seconds: 0 }),
    lastCycledAt: null,
    ...(extraProperties !== undefined ? { extraProperties } : {}),
  }
}

function createFakeTaskSourceRegistry(items: readonly TaskQueueItem[]): TaskSourceRegistry {
  const source: TaskSource = { getQueue: () => items }
  return {
    resolve: id => (id === taskSourceId ? source : undefined),
  }
}

function createDeps(overrides: Partial<AccumulatorHookDeps> = {}): AccumulatorHookDeps {
  return {
    frontmatterReader: createFakeReader(),
    ...overrides,
  }
}

describe('createAccumulatorHook', () => {
  test('exports ACCUMULATOR_HOOK_NAME as "accumulator"', () => {
    expect(ACCUMULATOR_HOOK_NAME).toBe(HookNameSchema.parse('accumulator'))
  })

  describe('trackerFilePath resolution precedence', () => {
    test('prefers context.params.trackerFilePath over all other sources', async () => {
      const reader = createFakeReader({
        'rewards/param-path.md': { stars: 10 },
        'tasks/task-1.md': { stars: 3 },
      })
      const hook = createAccumulatorHook(createDeps({
        frontmatterReader: reader,
        getTrackerFilePath: () => 'rewards/getter-path.md',
      }))

      const mutations = await hook(buildHookContext(focusPhase, 'tasks/task-1.md', {
        trackerFilePath: 'rewards/param-path.md',
        trackerFile: 'rewards/param-file.md',
      }))

      expect(mutations).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/param-path.md', property: 'stars', value: 13 },
      ])
    })

    test('uses context.params.trackerFile when trackerFilePath is omitted', async () => {
      const reader = createFakeReader({
        'rewards/param-file.md': { stars: 4 },
        'tasks/task-1.md': { stars: 2 },
      })
      const hook = createAccumulatorHook(createDeps({
        frontmatterReader: reader,
        getTrackerFilePath: () => 'rewards/getter-path.md',
      }))

      const mutations = await hook(buildHookContext(focusPhase, 'tasks/task-1.md', {
        trackerFile: 'rewards/param-file.md',
      }))

      expect(mutations).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/param-file.md', property: 'stars', value: 6 },
      ])
    })

    test('uses deps.getTrackerFilePath(context) when params omit tracker path', async () => {
      const reader = createFakeReader({
        'rewards/star-jar.md': { stars: 7 },
        'tasks/task-1.md': { stars: 5 },
      })
      const hook = createAccumulatorHook(createDeps({
        frontmatterReader: reader,
        getTrackerFilePath: () => 'rewards/star-jar.md',
      }))

      const mutations = await hook(buildHookContext(focusPhase, 'tasks/task-1.md'))

      expect(mutations).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 12 },
      ])
    })

    test('falls back to context.phase.logTarget activeItem when params and getTrackerFilePath are omitted', async () => {
      const reader = createFakeReader({
        'tasks/task-1.md': { stars: 2 },
      })
      const hook = createAccumulatorHook(createDeps({
        frontmatterReader: reader,
      }))

      const mutations = await hook(buildHookContext(focusPhase, 'tasks/task-1.md', {
        defaultAmount: 3,
      }))

      expect(mutations).toEqual([
        { kind: 'frontmatter', filePath: 'tasks/task-1.md', property: 'stars', value: 5 },
      ])
    })

    test('resolves callback logTarget via logTargetResolverRegistry or callback name', async () => {
      const reader = createFakeReader({
        'rewards/resolved-jar.md': { stars: 8 },
        'tasks/task-1.md': { stars: 4 },
      })
      const resolver: LogTargetResolver = () => 'rewards/resolved-jar.md'
      const logTargetResolverRegistry: LogTargetResolverRegistry = {
        resolve: name => (name === LogTargetResolverNameSchema.parse('starJarNote') ? resolver : undefined),
      }
      const hook = createAccumulatorHook(createDeps({
        frontmatterReader: reader,
        logTargetResolverRegistry,
      }))

      const mutations = await hook(buildHookContext(callbackPhase, 'tasks/task-1.md'))

      expect(mutations).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/resolved-jar.md', property: 'stars', value: 12 },
      ])
    })

    test('returns empty array when no trackerFilePath can be resolved', async () => {
      const reader = createFakeReader()
      const hook = createAccumulatorHook(createDeps({ frontmatterReader: reader }))

      const mutationsNullLogTarget = await hook(buildHookContext(untargetedPhase, 'tasks/task-1.md'))
      expect(mutationsNullLogTarget).toEqual([])

      const mutationsNullActiveFile = await hook(buildHookContext(focusPhase, null))
      expect(mutationsNullActiveFile).toEqual([])
      expect(reader.readValue).not.toHaveBeenCalled()
    })
  })

  describe('increment derivation and tracker accumulation', () => {
    test('reads increment from active item extraProperties in taskSource first', async () => {
      const reader = createFakeReader({
        'rewards/star-jar.md': { stars: 10 },
        'tasks/task-1.md': { stars: 99 },
      })
      const taskSourceRegistry = createFakeTaskSourceRegistry([
        createTaskItem('tasks/task-1.md', { stars: 5 }),
      ])
      const hook = createAccumulatorHook(createDeps({
        frontmatterReader: reader,
        taskSourceRegistry,
        getTrackerFilePath: () => 'rewards/star-jar.md',
      }))

      const mutations = await hook(buildHookContext(focusPhase, 'tasks/task-1.md', {
        defaultAmount: 1,
      }))

      expect(mutations).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 15 },
      ])
    })

    test('falls back to frontmatterReader on activeFilePath when extraProperties lacks itemProperty', async () => {
      const reader = createFakeReader({
        'rewards/star-jar.md': { stars: 6 },
        'tasks/task-1.md': { stars: 4 },
      })
      const taskSourceRegistry = createFakeTaskSourceRegistry([
        createTaskItem('tasks/task-1.md', { difficulty: 'medium' }),
      ])
      const hook = createAccumulatorHook(createDeps({
        frontmatterReader: reader,
        taskSourceRegistry,
        getTrackerFilePath: () => 'rewards/star-jar.md',
      }))

      const mutations = await hook(buildHookContext(focusPhase, 'tasks/task-1.md', {
        defaultAmount: 1,
      }))

      expect(mutations).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 10 },
      ])
    })

    test('falls back to defaultAmount, then amount, then 1 when item property is missing or non-numeric', async () => {
      const reader = createFakeReader({
        'rewards/star-jar.md': { stars: 3 },
        'tasks/task-1.md': { stars: 'not-a-number' },
      })
      const hook = createAccumulatorHook(createDeps({
        frontmatterReader: reader,
        getTrackerFilePath: () => 'rewards/star-jar.md',
      }))

      const withDefaultAmount = await hook(buildHookContext(focusPhase, 'tasks/task-1.md', {
        defaultAmount: 4,
        amount: 2,
      }))
      expect(withDefaultAmount).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 7 },
      ])

      const withAmount = await hook(buildHookContext(focusPhase, 'tasks/task-1.md', {
        amount: 2,
      }))
      expect(withAmount).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 5 },
      ])

      const withFallbackOne = await hook(buildHookContext(focusPhase, 'tasks/task-1.md'))
      expect(withFallbackOne).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 4 },
      ])
    })

    test('supports custom itemProperty and trackerProperty as well as shared property param', async () => {
      const reader = createFakeReader({
        'rewards/token-bank.md': { bankedTokens: 20, coins: 5 },
        'tasks/task-1.md': { taskTokens: 8, coins: 3 },
      })
      const hook = createAccumulatorHook(createDeps({
        frontmatterReader: reader,
        getTrackerFilePath: () => 'rewards/token-bank.md',
      }))

      const splitProps = await hook(buildHookContext(focusPhase, 'tasks/task-1.md', {
        itemProperty: 'taskTokens',
        trackerProperty: 'bankedTokens',
      }))
      expect(splitProps).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/token-bank.md', property: 'bankedTokens', value: 28 },
      ])

      const sharedProp = await hook(buildHookContext(focusPhase, 'tasks/task-1.md', {
        property: 'coins',
      }))
      expect(sharedProp).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/token-bank.md', property: 'coins', value: 8 },
      ])
    })

    test('defaults current tracker property to 0 when missing, null, or non-number', async () => {
      const reader = createFakeReader({
        'rewards/missing.md': {},
        'rewards/null-val.md': { stars: null },
        'rewards/string-val.md': { stars: 'ten' },
        'tasks/task-1.md': { stars: 3 },
      })
      const hook = createAccumulatorHook(createDeps({ frontmatterReader: reader }))

      for (const trackerFilePath of ['rewards/missing.md', 'rewards/null-val.md', 'rewards/string-val.md']) {
        const mutations = await hook(buildHookContext(focusPhase, 'tasks/task-1.md', { trackerFilePath }))
        expect(mutations).toEqual([
          { kind: 'frontmatter', filePath: trackerFilePath, property: 'stars', value: 3 },
        ])
      }
    })
  })

  describe('reset and deduct actions', () => {
    test('resets tracker property to 0 when action is "reset" or reset is true', async () => {
      const reader = createFakeReader({
        'rewards/star-jar.md': { stars: 18 },
      })
      const hook = createAccumulatorHook(createDeps({
        frontmatterReader: reader,
        getTrackerFilePath: () => 'rewards/star-jar.md',
      }))

      const fromAction = await hook(buildHookContext(untargetedPhase, null, {
        action: 'reset',
      }))
      expect(fromAction).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 0 },
      ])

      const fromFlag = await hook(buildHookContext(untargetedPhase, null, {
        reset: true,
      }))
      expect(fromFlag).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 0 },
      ])
    })

    test('resets tracker property to custom resetValue when provided', async () => {
      const reader = createFakeReader({
        'rewards/star-jar.md': { stars: 18 },
      })
      const hook = createAccumulatorHook(createDeps({
        frontmatterReader: reader,
        getTrackerFilePath: () => 'rewards/star-jar.md',
      }))

      const mutations = await hook(buildHookContext(untargetedPhase, null, {
        action: 'reset',
        resetValue: 5,
        property: 'stars',
      }))

      expect(mutations).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 5 },
      ])
    })

    test('deducts configured amount from tracker property and floors at 0', async () => {
      const reader = createFakeReader({
        'rewards/star-jar.md': { stars: 15 },
      })
      const hook = createAccumulatorHook(createDeps({
        frontmatterReader: reader,
        getTrackerFilePath: () => 'rewards/star-jar.md',
      }))

      const partialDeduct = await hook(buildHookContext(untargetedPhase, null, {
        action: 'deduct',
        amount: 10,
      }))
      expect(partialDeduct).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 5 },
      ])

      const defaultDeduct = await hook(buildHookContext(untargetedPhase, null, {
        action: 'deduct',
      }))
      expect(defaultDeduct).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 14 },
      ])

      const flooredDeduct = await hook(buildHookContext(untargetedPhase, null, {
        action: 'deduct',
        amount: 25,
      }))
      expect(flooredDeduct).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 0 },
      ])
    })
  })

  describe('preset handlers and EngineStore integration', () => {
    test('PresetHandlerNameSchema and HandlerSchema accept accumulateReward, resetReward, and deductReward', () => {
      expect(PresetHandlerNameSchema.parse('accumulateReward')).toBe('accumulateReward')
      expect(PresetHandlerNameSchema.parse('resetReward')).toBe('resetReward')
      expect(PresetHandlerNameSchema.parse('deductReward')).toBe('deductReward')

      expect(HandlerSchema.parse({
        kind: 'preset',
        preset: 'accumulateReward',
        params: { trackerFilePath: 'rewards/star-jar.md', property: 'stars' },
      })).toEqual({
        kind: 'preset',
        preset: 'accumulateReward',
        params: { trackerFilePath: 'rewards/star-jar.md', property: 'stars' },
      })
    })

    test('executeHandler executes accumulateReward, deductReward, and resetReward presets', async () => {
      const hookContext = buildHookContext(focusPhase, 'tasks/task-1.md')
      const handlerContext: HandlerContext = {
        phase: hookContext.phase,
        instance: hookContext.instance,
        session: hookContext.session,
        activeFilePath: hookContext.activeFilePath,
        now: Temporal.Instant.from('2026-10-20T12:00:00Z'),
      }
      const reader = createFakeReader({
        'rewards/star-jar.md': { stars: 12 },
        'tasks/task-1.md': { stars: 3 },
      })

      const accEffects = await executeHandler(
        { kind: 'preset', preset: 'accumulateReward', params: { trackerFilePath: 'rewards/star-jar.md' } },
        handlerContext,
        { frontmatterReader: reader },
      )
      expect(accEffects).toEqual([
        {
          kind: 'fileMutation',
          mutations: [{ kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 15 }],
        },
      ])

      const deductEffects = await executeHandler(
        { kind: 'preset', preset: 'deductReward', params: { trackerFilePath: 'rewards/star-jar.md', amount: 15 } },
        handlerContext,
        { frontmatterReader: reader },
      )
      expect(deductEffects).toEqual([
        {
          kind: 'fileMutation',
          mutations: [{ kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 0 }],
        },
      ])

      const resetEffects = await executeHandler(
        { kind: 'preset', preset: 'resetReward', params: { trackerFilePath: 'rewards/star-jar.md' } },
        handlerContext,
        { frontmatterReader: reader },
      )
      expect(resetEffects).toEqual([
        {
          kind: 'fileMutation',
          mutations: [{ kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 0 }],
        },
      ])
    })

    test('EngineStore accumulates stars on task phase completion, transitions to prize break at threshold, and resets bank on exit', async () => {
      let vaultFrontmatter: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
        'rewards/star-jar.md': { stars: 12 },
        'tasks/big-task.md': { stars: 3 },
      }
      const frontmatterReader: FrontmatterReader = {
        readValue: (path, prop) => vaultFrontmatter[path]?.[prop],
        readAll: path => (vaultFrontmatter[path] ? { ...vaultFrontmatter[path] } : null),
      }
      let appliedMutations: readonly FileMutation[] = []
      const port: FileMutationPort = {
        writeFrontmatter: async (mutation) => {
          appliedMutations = [...appliedMutations, mutation]
          if (mutation.kind === 'frontmatter') {
            vaultFrontmatter = {
              ...vaultFrontmatter,
              [mutation.filePath]: {
                ...(vaultFrontmatter[mutation.filePath] ?? {}),
                [mutation.property]: mutation.value,
              },
            }
          }
        },
        appendText: async () => {},
        reorderQueueItem: async () => {},
        changeQueueItemStatus: async () => {},
      }

      const taskSourceRegistry = createFakeTaskSourceRegistry([
        createTaskItem('tasks/big-task.md', { stars: 3 }),
      ])
      const accumulatorHook = createAccumulatorHook({
        frontmatterReader,
        taskSourceRegistry,
        getTrackerFilePath: () => 'rewards/star-jar.md',
      })
      const hookRegistry: HookRegistry = {
        resolve: name => (name === ACCUMULATOR_HOOK_NAME ? accumulatorHook : undefined),
      }
      const predicateRegistry = createFormulaPredicateRegistry()
      predicateRegistry.setFormulas([
        { name: PredicateNameSchema.parse('star-jar-full'), formula: 'tracker.stars >= 15' },
      ])

      const graph = PhaseGraphSchema.parse({
        id: 'star-jar-routine',
        name: 'Star Jar Routine',
        trackerFilePath: 'rewards/star-jar.md',
        phases: [
          {
            id: 'focus',
            name: 'Focus',
            label: 'Focus',
            kind: 'focus',
            duration: 'PT25M',
            onCompletion: 'waitForManual',
            taskSourceId: 'star-tasks',
            logTarget: { kind: 'activeItem' },
            handlers: {
              onComplete: [
                { kind: 'script', scriptPath: 'accumulator' },
              ],
            },
          },
          {
            id: 'short-break',
            name: 'Short break',
            label: 'Short break',
            kind: 'break',
            duration: 'PT5M',
            onCompletion: 'autoAdvance',
            handlers: {},
          },
          {
            id: 'prize-break',
            name: 'Prize break',
            label: 'Prize break',
            kind: 'break',
            duration: 'PT30M',
            onCompletion: 'autoAdvance',
            handlers: {
              onExit: [
                { kind: 'preset', preset: 'resetReward' },
              ],
            },
          },
        ],
        transitions: [
          { from: 'focus', to: 'prize-break', guard: { kind: 'custom', predicate: 'star-jar-full' } },
          { from: 'focus', to: 'short-break', guard: { kind: 'always' } },
          { from: 'short-break', to: 'focus', guard: { kind: 'always' } },
          { from: 'prize-break', to: 'focus', guard: { kind: 'always' } },
        ],
      })

      const store = new EngineStore(graph, {
        hookRegistry,
        port,
        predicateRegistry,
        taskSourceRegistry,
        frontmatterReader,
      })

      await store.dispatch({ type: 'start', filePath: 'tasks/big-task.md' })
      await store.dispatch({ type: 'finish-phase' })

      expect(vaultFrontmatter['rewards/star-jar.md']?.stars).toBe(15)
      expect(store.getState().trackerFrontmatter).toEqual({ stars: 15 })

      await store.dispatch({ type: 'advance-phase' })
      expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('prize-break'))

      await store.dispatch({ type: 'start' })
      await store.dispatch({ type: 'finish-phase' })

      expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('focus'))
      expect(vaultFrontmatter['rewards/star-jar.md']?.stars).toBe(0)
      expect(store.getState().trackerFrontmatter).toEqual({ stars: 0 })
      expect(appliedMutations).toEqual([
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 15 },
        { kind: 'frontmatter', filePath: 'rewards/star-jar.md', property: 'stars', value: 0 },
      ])
    })
  })
})
