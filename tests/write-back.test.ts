import { mock, test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { PhaseSchema } from '../src/domain/phase/phase'
import type { Phase } from '../src/domain/phase/phase'
import { LogTargetResolverNameSchema } from '../src/domain/phase/phase'
import { PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'
import { PhaseInstanceIdSchema, SessionIdSchema } from '../src/domain/session/session'
import type { LogTargetResolverRegistry, LogTargetResolver } from '../src/domain/log-target/log-target-resolver'
import type { FrontmatterReader } from '../src/domain/mutation/frontmatter-reader'
import type { WriteBackFormValues, WriteBackPromptPort, WriteBackPromptResult } from '../src/domain/mutation/write-back-prompt'
import type { HookContext } from '../src/domain/hook/hook'
import { createWriteBackHook } from '../src/timer/write-back'
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

function createFakeReader(value: unknown): FrontmatterReader {
  return { readValue: mock((_filePath: string, _property: string) => value) }
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
    getWriteBackProperty: () => 'pomodoros',
    ...overrides,
  }
}

/** Builds a throwaway HookContext for a single write-back hook invocation — instance/session content doesn't affect the hook's behavior. */
function buildContext(phase: Phase, activeFilePath: string | null): HookContext {
  const now = Temporal.Now.instant()
  return {
    phase,
    activeFilePath,
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
      itemsTouched: [],
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

    expect(reader.readValue).toHaveBeenCalledWith('task.md', 'pomodoros')
    expect(prompt.prompt).toHaveBeenCalledWith({ filePath: 'task.md', property: 'pomodoros', value: 4 })
    expect(mutations).toEqual([{ kind: 'frontmatter', filePath: 'task.md', property: 'pomodoros', value: 4 }])
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

    expect(reader.readValue).toHaveBeenCalledWith('daily-note.md', 'pomodoros')
    expect(prompt.prompt).toHaveBeenCalledWith({ filePath: 'daily-note.md', property: 'pomodoros', value: 1 })
    expect(mutations).toEqual([{ kind: 'frontmatter', filePath: 'daily-note.md', property: 'pomodoros', value: 1 }])
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
})
