import { mock, test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { createScriptHookRegistry } from '../src/timer/script-hook-registry'
import { HookNameSchema } from '../src/domain/hook/hook-reference'
import type { FrontmatterReader } from '../src/domain/mutation/frontmatter-reader'
import { PhaseSchema } from '../src/domain/phase/phase'
import { PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'
import { PhaseInstanceIdSchema, SessionIdSchema } from '../src/domain/session/session'
import type { HookContext } from '../src/domain/hook/hook'

function createDeps() {
  const reader: FrontmatterReader = {
    readValue: mock((_filePath: string, _property: string) => undefined),
    readAll: mock((_filePath: string) => null),
  }
  return { frontmatterReader: reader }
}

/** Builds a throwaway HookContext for a single resolved hook's invocation — instance/session content doesn't affect these registry-level tests. */
function buildContext(): HookContext {
  const now = Temporal.Now.instant()
  const phase = PhaseSchema.parse({
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
  return {
    phase,
    activeFilePath: null,
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

describe('MutableScriptHookRegistry', () => {
  test('resolves a name registered via setBindings to a working Hook', async () => {
    const registry = createScriptHookRegistry(createDeps())
    const name = HookNameSchema.parse('log-focus-complete')
    registry.setBindings([{ name, scriptPath: 'scripts/log.js', scriptSource: `return [{ kind: 'append', filePath: 'daily.md', text: '- done' }];` }])

    const hook = registry.resolve(name)

    expect(hook).toBeDefined()
    const mutations = hook === undefined ? undefined : await hook(buildContext())
    expect(mutations).toEqual([{ kind: 'append', filePath: 'daily.md', text: '- done' }])
  })

  test('an unregistered name resolves to undefined', () => {
    const registry = createScriptHookRegistry(createDeps())

    expect(registry.resolve(HookNameSchema.parse('missing'))).toBeUndefined()
  })

  test('setBindings replaces the whole set — a name dropped from the list stops resolving', () => {
    const registry = createScriptHookRegistry(createDeps())
    const name = HookNameSchema.parse('temp')
    registry.setBindings([{ name, scriptPath: 'scripts/temp.js', scriptSource: 'return [];' }])
    expect(registry.resolve(name)).toBeDefined()

    registry.setBindings([])

    expect(registry.resolve(name)).toBeUndefined()
  })
})
