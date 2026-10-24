import { mock, test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { PhaseSchema } from '../src/domain/phase/phase'
import type { Phase } from '../src/domain/phase/phase'
import { LogTargetResolverNameSchema } from '../src/domain/phase/phase'
import { PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'
import { PhaseInstanceIdSchema, SessionIdSchema } from '../src/domain/session/session'
import type { ItemTouch } from '../src/domain/session/session'
import { TaskQueueItemIdSchema } from '../src/domain/queue/task-source'
import type { LogTargetResolverRegistry, LogTargetResolver } from '../src/domain/log-target/log-target-resolver'
import type { FrontmatterReader } from '../src/domain/mutation/frontmatter-reader'
import type { WriteBackFormValues, WriteBackPromptPort, WriteBackPromptResult } from '../src/domain/mutation/write-back-prompt'
import type { HookContext } from '../src/domain/hook/hook'
import { createWriteBackHook, resolveTargetFilePaths } from '../src/timer/write-back'
import type { WriteBackHookDeps } from '../src/timer/write-back'

const phaseDefaults = {
  label: 'Focus',
  duration: Temporal.Duration.from({ minutes: 25 }),
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  onEnter: null,
  onComplete: null,
  onSkip: null,
  onExit: null,
} as const

const activeItemPhase: Phase = PhaseSchema.parse({
  ...phaseDefaults,
  id: 'focus',
  kind: 'focus',
  logTarget: { kind: 'activeItem' },
})

const callbackPhase: Phase = PhaseSchema.parse({
  ...phaseDefaults,
  id: 'break',
  kind: 'break',
  label: 'Short break',
  logTarget: { kind: 'callback', name: 'dailyNote' },
})

const completedItemsPhase: Phase = PhaseSchema.parse({
  ...phaseDefaults,
  id: 'blitz',
  kind: 'focus',
  label: 'Chore blitz',
  logTarget: { kind: 'completedItems' },
})

function createFakeReader(value: unknown): FrontmatterReader {
  return {
    readValue: mock((_filePath: string, _property: string) => value),
    readAll: mock((_filePath: string) => null),
  }
}

function createFakeRegistry(resolvers: Record<string, LogTargetResolver> = {}): LogTargetResolverRegistry {
  return { resolve: name => resolvers[name] }
}

/** Defaults to auto-submitting whatever defaults it was prompted with, so existing "writes back" scenarios don't need to know about the prompt step. */
function createFakePrompt(resolve: (defaults: WriteBackFormValues) => WriteBackPromptResult = defaults => ({ kind: 'submitted', values: defaults })): WriteBackPromptPort {
  return {
    // eslint-disable-next-line functional/prefer-tacit -- the async wrapper is required so this satisfies WriteBackPromptPort's Promise-returning signature; `resolve` itself is synchronous
    prompt: mock(async (defaults: WriteBackFormValues) => resolve(defaults)),
  }
}

function createDeps(overrides: Partial<WriteBackHookDeps> = {}): WriteBackHookDeps {
  return {
    logTargetResolverRegistry: createFakeRegistry(),
    frontmatterReader: createFakeReader(undefined),
    writeBackPrompt: createFakePrompt(),
    getWriteBackProperty: () => 'sessions',
    ...overrides,
  }
}

/** Builds a throwaway HookContext for a single write-back hook invocation — instance/session content doesn't affect the hook's behavior. */
function buildContext(phase: Phase, activeFilePath: string | null, itemsTouched: readonly ItemTouch[] = []): HookContext {
  const now = Temporal.Now.instant()
  return {
    phase,
    activeFilePath,
    params: {},
    instance: {
      id: PhaseInstanceIdSchema.parse(crypto.randomUUID()),
      phaseId: phase.id,
      phaseDisplayName: phase.label,
      phaseKind: phase.kind,
      plannedDuration: phase.duration,
      actualDuration: Temporal.Duration.from({ seconds: 0 }),
      startedAt: now,
      endedAt: now,
      endReason: 'completed',
      itemsTouched,
      mutationsApplied: [],
      hookFailures: [],
    },
    session: {
      id: SessionIdSchema.parse(crypto.randomUUID()),
      phaseGraphId: PhaseGraphIdSchema.parse('test'),
      startedAt: now,
      endedAt: now,
      currentInstance: null,
      history: [],
    },
  }
}

describe('createWriteBackHook', () => {
  test('activeItem target with an active file prompts and writes back on submit', async () => {
    const reader = createFakeReader(3)
    const prompt = createFakePrompt()
    const hook = createWriteBackHook(createDeps({ frontmatterReader: reader, writeBackPrompt: prompt }))

    const mutations = await hook(buildContext(activeItemPhase, 'task.md'))

    expect(reader.readValue).toHaveBeenCalledWith('task.md', 'sessions')
    expect(prompt.prompt).toHaveBeenCalledWith({ filePath: 'task.md', property: 'sessions', value: 4 })
    expect(mutations).toEqual([{ kind: 'frontmatter', filePath: 'task.md', property: 'sessions', value: 4 }])
  })

  test('activeItem target with no active file is skipped without prompting', async () => {
    const reader = createFakeReader(3)
    const prompt = createFakePrompt()
    const hook = createWriteBackHook(createDeps({ frontmatterReader: reader, writeBackPrompt: prompt }))

    const mutations = await hook(buildContext(activeItemPhase, null))

    expect(mutations).toEqual([])
    expect(reader.readValue).not.toHaveBeenCalled()
    expect(prompt.prompt).not.toHaveBeenCalled()
  })

  test('callback target with an unregistered resolver is skipped without prompting', async () => {
    const reader = createFakeReader(3)
    const prompt = createFakePrompt()
    const hook = createWriteBackHook(createDeps({ frontmatterReader: reader, writeBackPrompt: prompt }))

    const mutations = await hook(buildContext(callbackPhase, null))

    expect(mutations).toEqual([])
    expect(reader.readValue).not.toHaveBeenCalled()
    expect(prompt.prompt).not.toHaveBeenCalled()
  })

  test('callback target with a registered resolver prompts and writes back on submit', async () => {
    const reader = createFakeReader(undefined)
    const prompt = createFakePrompt()
    const resolver: LogTargetResolver = () => 'daily-note.md'
    const hook = createWriteBackHook(createDeps({
      frontmatterReader: reader,
      writeBackPrompt: prompt,
      logTargetResolverRegistry: createFakeRegistry({ [LogTargetResolverNameSchema.parse('dailyNote')]: resolver }),
    }))

    const mutations = await hook(buildContext(callbackPhase, null))

    expect(reader.readValue).toHaveBeenCalledWith('daily-note.md', 'sessions')
    expect(prompt.prompt).toHaveBeenCalledWith({ filePath: 'daily-note.md', property: 'sessions', value: 1 })
    expect(mutations).toEqual([{ kind: 'frontmatter', filePath: 'daily-note.md', property: 'sessions', value: 1 }])
  })

  test('callback target with a registered resolver that returns null is skipped without prompting', async () => {
    const reader = createFakeReader(3)
    const prompt = createFakePrompt()
    const resolver: LogTargetResolver = () => null
    const hook = createWriteBackHook(createDeps({
      frontmatterReader: reader,
      writeBackPrompt: prompt,
      logTargetResolverRegistry: createFakeRegistry({ [LogTargetResolverNameSchema.parse('dailyNote')]: resolver }),
    }))

    const mutations = await hook(buildContext(callbackPhase, null))

    expect(mutations).toEqual([])
    expect(reader.readValue).not.toHaveBeenCalled()
    expect(prompt.prompt).not.toHaveBeenCalled()
  })

  test('a non-focus (break-kind) phase with a resolvable target still writes back', async () => {
    const reader = createFakeReader(undefined)
    const resolver: LogTargetResolver = () => 'daily-note.md'
    const hook = createWriteBackHook(createDeps({
      frontmatterReader: reader,
      logTargetResolverRegistry: createFakeRegistry({ [LogTargetResolverNameSchema.parse('dailyNote')]: resolver }),
    }))

    const mutations = await hook(buildContext(callbackPhase, null))

    expect(mutations).toHaveLength(1)
    expect(mutations[0]).toMatchObject({ kind: 'frontmatter', filePath: 'daily-note.md' })
  })

  test('cancelling the prompt is skipped and never returns a mutation', async () => {
    const reader = createFakeReader(3)
    const prompt = createFakePrompt(() => ({ kind: 'cancelled' }))
    const hook = createWriteBackHook(createDeps({ frontmatterReader: reader, writeBackPrompt: prompt }))

    const mutations = await hook(buildContext(activeItemPhase, 'task.md'))

    expect(mutations).toEqual([])
  })

  test('submitting edited values returns a mutation built from the edits, not the original defaults', async () => {
    const reader = createFakeReader(3)
    const editedValues: WriteBackFormValues = { filePath: 'other-task.md', property: 'sessions', value: 'edited' }
    const prompt = createFakePrompt(() => ({ kind: 'submitted', values: editedValues }))
    const hook = createWriteBackHook(createDeps({ frontmatterReader: reader, writeBackPrompt: prompt }))

    const mutations = await hook(buildContext(activeItemPhase, 'task.md'))

    expect(mutations).toEqual([{ kind: 'frontmatter', filePath: 'other-task.md', property: 'sessions', value: 'edited' }])
  })

  test('skips prompt and writes back silently when getConfirmWriteBack returns false', async () => {
    const reader = createFakeReader(3)
    const prompt = createFakePrompt()
    const hook = createWriteBackHook(createDeps({
      frontmatterReader: reader,
      writeBackPrompt: prompt,
      getConfirmWriteBack: () => false,
    }))

    const mutations = await hook(buildContext(activeItemPhase, 'task.md'))

    expect(prompt.prompt).not.toHaveBeenCalled()
    expect(mutations).toEqual([{ kind: 'frontmatter', filePath: 'task.md', property: 'sessions', value: 4 }])
  })

  test('skips prompt and writes back silently when per-phase params specify prompt: false', async () => {
    const reader = createFakeReader(3)
    const prompt = createFakePrompt()
    const hook = createWriteBackHook(createDeps({ frontmatterReader: reader, writeBackPrompt: prompt }))

    const context = {
      ...buildContext(activeItemPhase, 'task.md'),
      params: { prompt: false },
    }
    const mutations = await hook(context)

    expect(prompt.prompt).not.toHaveBeenCalled()
    expect(mutations).toEqual([{ kind: 'frontmatter', filePath: 'task.md', property: 'sessions', value: 4 }])
  })

  test('skips prompt and writes back silently when per-phase params specify confirm: false or skipPrompt: true', async () => {
    const reader = createFakeReader(1)
    const prompt = createFakePrompt()
    const hook = createWriteBackHook(createDeps({ frontmatterReader: reader, writeBackPrompt: prompt }))

    const contextConfirm = {
      ...buildContext(activeItemPhase, 'task.md'),
      params: { confirm: false },
    }
    const mutationsConfirm = await hook(contextConfirm)

    expect(prompt.prompt).not.toHaveBeenCalled()
    expect(mutationsConfirm).toEqual([{ kind: 'frontmatter', filePath: 'task.md', property: 'sessions', value: 2 }])

    const contextSkip = {
      ...buildContext(activeItemPhase, 'task.md'),
      params: { skipPrompt: true },
    }
    const mutationsSkip = await hook(contextSkip)

    expect(prompt.prompt).not.toHaveBeenCalled()
    expect(mutationsSkip).toEqual([{ kind: 'frontmatter', filePath: 'task.md', property: 'sessions', value: 2 }])
  })

  test('cooldown reflection phase write-back captures notes and increments sessions on active task file', async () => {
    const cooldownPhase: Phase = PhaseSchema.parse({
      ...phaseDefaults,
      id: 'cooldown',
      kind: 'cooldown',
      label: 'Cooldown reflection',
      duration: null,
      logTarget: { kind: 'activeItem' },
    })

    const reader = createFakeReader(2)
    const prompt = createFakePrompt(defaults => ({
      kind: 'submitted',
      values: { ...defaults, value: 3 },
    }))

    const hook = createWriteBackHook(createDeps({
      frontmatterReader: reader,
      writeBackPrompt: prompt,
      getWriteBackProperty: () => 'sessions',
    }))

    const context = buildContext(cooldownPhase, 'focus-sandwich/task-1.md')
    const mutations = await hook(context)

    expect(prompt.prompt).toHaveBeenCalledTimes(1)
    expect(mutations).toEqual([
      { kind: 'frontmatter', filePath: 'focus-sandwich/task-1.md', property: 'sessions', value: 3 },
    ])
  })

  test('completed items target generates batch mutations across finished tasks', async () => {
    const reader = createFakeReader(0)
    const prompt = createFakePrompt()
    const hook = createWriteBackHook(createDeps({
      frontmatterReader: reader,
      writeBackPrompt: prompt,
      getConfirmWriteBack: () => false,
    }))

    const itemsTouched: readonly ItemTouch[] = [
      {
        id: TaskQueueItemIdSchema.parse('chore-1'),
        sourcePath: 'chores/chore-1.md',
        displayName: 'Chore 1',
        status: 'completed',
        completedAt: Temporal.Instant.from('2026-10-23T12:01:00Z'),
      },
      {
        id: TaskQueueItemIdSchema.parse('chore-2'),
        sourcePath: 'chores/chore-2.md',
        displayName: 'Chore 2',
        status: 'completed',
        completedAt: Temporal.Instant.from('2026-10-23T12:02:00Z'),
      },
      {
        id: TaskQueueItemIdSchema.parse('chore-3'),
        sourcePath: 'chores/chore-3.md',
        displayName: 'Chore 3',
        status: 'viewed',
        completedAt: null,
      },
    ]

    const context = buildContext(completedItemsPhase, 'chores/chore-3.md', itemsTouched)
    const mutations = await hook(context)

    expect(prompt.prompt).not.toHaveBeenCalled()
    expect(mutations).toEqual([
      { kind: 'frontmatter', filePath: 'chores/chore-1.md', property: 'sessions', value: 1 },
      { kind: 'frontmatter', filePath: 'chores/chore-2.md', property: 'sessions', value: 1 },
    ])
  })

  test('batch write-back succeeds when activeFilePath is null upon queue depletion', async () => {
    const reader = createFakeReader(2)
    const hook = createWriteBackHook(createDeps({
      frontmatterReader: reader,
      getConfirmWriteBack: () => false,
    }))

    const itemsTouched: readonly ItemTouch[] = [
      {
        id: TaskQueueItemIdSchema.parse('chore-1'),
        sourcePath: 'chores/chore-1.md',
        displayName: 'Chore 1',
        status: 'completed',
        completedAt: Temporal.Instant.from('2026-10-23T12:01:00Z'),
      },
      {
        id: TaskQueueItemIdSchema.parse('chore-2'),
        sourcePath: 'chores/chore-2.md',
        displayName: 'Chore 2',
        status: 'completed',
        completedAt: Temporal.Instant.from('2026-10-23T12:02:00Z'),
      },
    ]

    const context = buildContext(completedItemsPhase, null, itemsTouched)
    const mutations = await hook(context)

    expect(mutations).toEqual([
      { kind: 'frontmatter', filePath: 'chores/chore-1.md', property: 'sessions', value: 3 },
      { kind: 'frontmatter', filePath: 'chores/chore-2.md', property: 'sessions', value: 3 },
    ])
  })

  test('zero completed items produces empty mutation list without reading frontmatter or prompting', async () => {
    const reader = createFakeReader(0)
    const prompt = createFakePrompt()
    const hook = createWriteBackHook(createDeps({
      frontmatterReader: reader,
      writeBackPrompt: prompt,
    }))

    const itemsTouched: readonly ItemTouch[] = [
      {
        id: TaskQueueItemIdSchema.parse('chore-1'),
        sourcePath: 'chores/chore-1.md',
        displayName: 'Chore 1',
        status: 'viewed',
        completedAt: null,
      },
    ]

    const context = buildContext(completedItemsPhase, null, itemsTouched)
    const mutations = await hook(context)

    expect(mutations).toEqual([])
    expect(reader.readValue).not.toHaveBeenCalled()
    expect(prompt.prompt).not.toHaveBeenCalled()
  })

  test('prompts each completed item sequentially and skips cancelled items', async () => {
    const reader = createFakeReader(1)
    const prompt = createFakePrompt((defaults) => {
      if (defaults.filePath === 'chores/chore-1.md') {
        return { kind: 'submitted', values: { ...defaults, value: 10 } }
      }
      return { kind: 'cancelled' }
    })
    const hook = createWriteBackHook(createDeps({
      frontmatterReader: reader,
      writeBackPrompt: prompt,
      getConfirmWriteBack: () => true,
    }))

    const itemsTouched: readonly ItemTouch[] = [
      {
        id: TaskQueueItemIdSchema.parse('chore-1'),
        sourcePath: 'chores/chore-1.md',
        displayName: 'Chore 1',
        status: 'completed',
        completedAt: Temporal.Instant.from('2026-10-23T12:01:00Z'),
      },
      {
        id: TaskQueueItemIdSchema.parse('chore-2'),
        sourcePath: 'chores/chore-2.md',
        displayName: 'Chore 2',
        status: 'completed',
        completedAt: Temporal.Instant.from('2026-10-23T12:02:00Z'),
      },
    ]

    const context = buildContext(completedItemsPhase, null, itemsTouched)
    const mutations = await hook(context)

    expect(prompt.prompt).toHaveBeenCalledTimes(2)
    expect(mutations).toEqual([
      { kind: 'frontmatter', filePath: 'chores/chore-1.md', property: 'sessions', value: 10 },
    ])
  })
})

describe('resolveTargetFilePaths', () => {
  test('returns empty array when logTarget is null', () => {
    const nullTargetPhase = PhaseSchema.parse({ ...phaseDefaults, id: 'rest', kind: 'break', logTarget: null })
    const paths = resolveTargetFilePaths(nullTargetPhase, null, 'active.md', createFakeRegistry())
    expect(paths).toEqual([])
  })

  test('returns activeFilePath when logTarget is activeItem', () => {
    const paths = resolveTargetFilePaths(activeItemPhase, null, 'task.md', createFakeRegistry())
    expect(paths).toEqual(['task.md'])
  })

  test('returns empty array when activeItem has null activeFilePath', () => {
    const paths = resolveTargetFilePaths(activeItemPhase, null, null, createFakeRegistry())
    expect(paths).toEqual([])
  })

  test('returns deduplicated list of completed items for completedItems logTarget', () => {
    const now = Temporal.Now.instant()
    const instance = {
      id: PhaseInstanceIdSchema.parse(crypto.randomUUID()),
      phaseId: completedItemsPhase.id,
      phaseDisplayName: completedItemsPhase.label,
      phaseKind: completedItemsPhase.kind,
      plannedDuration: completedItemsPhase.duration,
      actualDuration: Temporal.Duration.from({ seconds: 0 }),
      startedAt: now,
      endedAt: now,
      endReason: 'completed' as const,
      itemsTouched: [
        {
          id: TaskQueueItemIdSchema.parse('t-1'),
          sourcePath: 'tasks/task-1.md',
          displayName: 'Task 1',
          status: 'completed' as const,
          completedAt: now,
        },
        {
          id: TaskQueueItemIdSchema.parse('t-2'),
          sourcePath: 'tasks/task-2.md',
          displayName: 'Task 2',
          status: 'viewed' as const,
          completedAt: null,
        },
        {
          id: TaskQueueItemIdSchema.parse('t-1-repeat'),
          sourcePath: 'tasks/task-1.md',
          displayName: 'Task 1',
          status: 'completed' as const,
          completedAt: now,
        },
      ],
      mutationsApplied: [],
      hookFailures: [],
    }

    const paths = resolveTargetFilePaths(completedItemsPhase, instance, null, createFakeRegistry())
    expect(paths).toEqual(['tasks/task-1.md'])
  })

  test('returns empty array for completedItems when instance is missing or has no completed items', () => {
    expect(resolveTargetFilePaths(completedItemsPhase, null, null, createFakeRegistry())).toEqual([])
  })

  test('returns resolved callback path when callback resolver exists and returns string', () => {
    const registry = createFakeRegistry({
      [LogTargetResolverNameSchema.parse('dailyNote')]: () => 'daily/note.md',
    })
    expect(resolveTargetFilePaths(callbackPhase, null, null, registry)).toEqual(['daily/note.md'])
  })

  test('returns empty array when callback resolver returns null', () => {
    const registry = createFakeRegistry({
      [LogTargetResolverNameSchema.parse('dailyNote')]: () => null,
    })
    expect(resolveTargetFilePaths(callbackPhase, null, null, registry)).toEqual([])
  })
})
