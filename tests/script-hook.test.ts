import { mock, test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { PhaseSchema } from '../src/domain/phase/phase'
import type { Phase } from '../src/domain/phase/phase'
import { PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'
import { PhaseInstanceIdSchema, SessionIdSchema } from '../src/domain/session/session'
import type { FrontmatterReader } from '../src/domain/mutation/frontmatter-reader'
import type { HookContext } from '../src/domain/hook/hook'
import { createScriptHook } from '../src/timer/script-hook'
import type { ScriptHookDeps, ScriptHookTimers } from '../src/timer/script-hook'

const phase: Phase = PhaseSchema.parse({
  id: 'focus',
  label: 'Focus',
  kind: 'focus',
  duration: Temporal.Duration.from({ minutes: 25 }),
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  logTarget: { kind: 'activeItem' },
  onEnter: null,
  onComplete: null,
  onSkip: null,
  onExit: null,
})

function createFakeReader(all: Readonly<Record<string, unknown>> | null): FrontmatterReader {
  return {
    readValue: mock((_filePath: string, _property: string) => undefined),
    readAll: mock((_filePath: string) => all),
  }
}

/**
 * Real (not fake) setTimeout/clearTimeout, bypassing `window` -- unavailable
 * under `bun test` -- so timeout-path tests exercise genuine timing. Maps
 * ScriptHookTimers' `number` ids to Bun's real Timer objects internally,
 * rather than casting one into the other.
 */
function createRealTimers(): ScriptHookTimers {
  let pending: ReadonlyMap<number, ReturnType<typeof setTimeout>> = new Map()
  let nextId = 0
  return {
    setTimeout: (callback, delayMs) => {
      nextId += 1
      const id = nextId
      pending = new Map([...pending, [id, setTimeout(callback, delayMs)]])
      return id
    },
    clearTimeout: (id) => {
      const timer = pending.get(id)
      if (timer !== undefined) {
        clearTimeout(timer)
        pending = new Map([...pending].filter(([key]) => key !== id))
      }
    },
  }
}

const realTimers: ScriptHookTimers = createRealTimers()

function createDeps(overrides: Partial<ScriptHookDeps> = {}): ScriptHookDeps {
  return {
    frontmatterReader: createFakeReader(null),
    timers: realTimers,
    ...overrides,
  }
}

/** Builds a throwaway HookContext for a single script-hook invocation — instance/session content doesn't affect the hook's own behavior. */
function buildContext(activeFilePath: string | null): HookContext {
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

// bun-types' `Matchers.toThrow()` is declared to return `void` even under
// `.rejects`, so `await expect(promise).rejects.toThrow()` trips
// `@typescript-eslint/await-thenable` (see tests/obsidian-file-mutation-port.test.ts
// for the established workaround). Await the promise's own outcome instead,
// returning the rejection reason so callers can assert on its message.
async function expectRejection(promise: Promise<unknown>): Promise<unknown> {
  const settled = await promise.then(
    (value: unknown) => ({ kind: 'resolved' as const, value }),
    (cause: unknown) => ({ kind: 'rejected' as const, cause }),
  )
  expect(settled.kind).toBe('rejected')
  return settled.kind === 'rejected' ? settled.cause : undefined
}

/** Narrows an `unknown` rejection cause to Error and asserts its message, without a type-assertion cast. */
function expectErrorMessage(cause: unknown, match: string | RegExp): void {
  if (!(cause instanceof Error)) {
    throw new Error(`expected an Error, got ${typeof cause}`)
  }
  expect(cause.message).toMatch(match)
}

describe('createScriptHook', () => {
  test('a script returning mutations resolves with them', async () => {
    const hook = createScriptHook(
      `return [{ kind: 'append', filePath: 'daily-note.md', text: '- done' }];`,
      createDeps(),
    )

    const mutations = await hook(buildContext(null))

    expect(mutations).toEqual([{ kind: 'append', filePath: 'daily-note.md', text: '- done' }])
  })

  test('a script that returns nothing rejects (invocation failure), not a silent no-op', async () => {
    const hook = createScriptHook(`// no return statement`, createDeps())

    await expectRejection(hook(buildContext(null)))
  })

  test('a script that returns a shape not matching FileMutation[] rejects', async () => {
    const hook = createScriptHook(`return 'not an array of mutations';`, createDeps())

    await expectRejection(hook(buildContext(null)))
  })

  test('a synchronously throwing script rejects with its own error', async () => {
    const hook = createScriptHook(`throw new Error('script bug');`, createDeps())

    const cause = await expectRejection(hook(buildContext(null)))

    expectErrorMessage(cause, 'script bug')
  })

  test('a script whose promise never settles is treated as a failure once the timeout elapses', async () => {
    const hook = createScriptHook(
      `await new Promise(() => {});`,
      createDeps({ timeoutMs: 5 }),
    )

    const cause = await expectRejection(hook(buildContext(null)))

    expectErrorMessage(cause, /timed out/)
  })

  test('the script receives the active file\'s frontmatter under activeFileFrontmatter', async () => {
    const reader = createFakeReader({ sessions: 3 })
    const hook = createScriptHook(
      `return [{ kind: 'frontmatter', filePath: context.activeFilePath, property: 'sessions', value: context.activeFileFrontmatter.sessions }];`,
      createDeps({ frontmatterReader: reader }),
    )

    const mutations = await hook(buildContext('task.md'))

    expect(reader.readAll).toHaveBeenCalledWith('task.md')
    expect(mutations).toEqual([{ kind: 'frontmatter', filePath: 'task.md', property: 'sessions', value: 3 }])
  })

  test('activeFileFrontmatter is null and the reader is not consulted when there is no active file', async () => {
    const reader = createFakeReader({ sessions: 3 })
    const hook = createScriptHook(
      `return [{ kind: 'frontmatter', filePath: 'note.md', property: 'sawNull', value: context.activeFileFrontmatter === null }];`,
      createDeps({ frontmatterReader: reader }),
    )

    const mutations = await hook(buildContext(null))

    expect(reader.readAll).not.toHaveBeenCalled()
    expect(mutations).toEqual([{ kind: 'frontmatter', filePath: 'note.md', property: 'sawNull', value: true }])
  })
})
