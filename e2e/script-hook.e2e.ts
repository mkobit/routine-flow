import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { createNote, writeNoteToVault } from './vault'
import type { EngineAction } from '../src/timer/reducer'
import { HookNameSchema } from '../src/domain/hook/hook-reference'
import type { HookName } from '../src/domain/hook/hook-reference'

const PLUGIN_ID = 'routine-flow'
const TASK_PATH = 'script-hook-e2e-task.md'
const HOOK_NAME = HookNameSchema.parse('e2e-log-focus-complete')

function dispatchAction(page: Page, action: EngineAction): Promise<unknown> {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID, action: EngineAction }) =>
    app.plugins.plugins[args.pluginId]!.store.dispatch(args.action), { pluginId: PLUGIN_ID, action })
}

/**
 * Registers a script-hook binding directly against the plugin's live
 * MutableScriptHookRegistry, bypassing the settings-tab UI. The UI's own
 * mechanics (Setting()/AbstractInputSuggest/Modal) already follow the exact
 * patterns write-back-modal.e2e.ts and routine-replace-modal.e2e.ts cover;
 * this test targets what's actually new here -- a vault-authored script
 * compiled via `new Function` and executed in real Obsidian's Electron
 * renderer, not a fake in a unit test.
 */
function registerScriptHookBinding(page: Page, name: HookName, scriptSource: string): Promise<void> {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID, name: HookName, scriptSource: string }) => {
    const plugin = app.plugins.plugins[args.pluginId]!
    plugin.scriptHookRegistry.setBindings([{ name: args.name, scriptPath: 'e2e-inline.js', scriptSource: args.scriptSource }])
  }, { pluginId: PLUGIN_ID, name, scriptSource })
}

/**
 * Points the focus phase's onComplete at a script-hook binding's name via a
 * live setGraph, instead of the default graph's write-back binding --
 * avoids constructing a Temporal/zod-validated PhaseGraph from scratch
 * inside the page context; cloning the plugin's own already-valid graph and
 * replacing one field keeps every other Temporal-bearing field intact.
 */
function pointFocusOnCompleteAt(page: Page, name: HookName): Promise<void> {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID, name: HookName }) => {
    const plugin = app.plugins.plugins[args.pluginId]!
    const graph = plugin.store.getGraph()
    const nextGraph = {
      ...graph,
      phases: graph.phases.map(phase => String(phase.kind) !== 'focus' ? phase : { ...phase, handlers: { ...phase.handlers, onComplete: [{ kind: 'script' as const, scriptPath: args.name }] } }),
    }
    plugin.store.setGraph(nextGraph)
  }, { pluginId: PLUGIN_ID, name })
}

/**
 * Same simulated-ticks completion pattern as write-back-modal.e2e.ts's
 * completeFocusPhase. Unlike write-back, a script hook doesn't block on an
 * interactive prompt, so the final dispatch can be awaited normally instead
 * of deliberately left to settle later.
 */
async function completeFocusPhase(page: Page): Promise<void> {
  await dispatchAction(page, { type: 'pause' })
  await evaluateObsidian(page, async (app, args: { pluginId: typeof PLUGIN_ID }) => {
    const store = app.plugins.plugins[args.pluginId]!.store
    const remainingSeconds = store.getState().remaining?.total({ unit: 'seconds' }) ?? 0
    for (let i = 0; i < remainingSeconds; i += 1) {
      await store.dispatch({ type: 'tick' })
    }
  }, { pluginId: PLUGIN_ID })
  await dispatchAction(page, { type: 'tick' })
}

function readFrontmatterValue(page: Page, filePath: string, property: string): Promise<unknown> {
  return evaluateObsidian(page, (app, args: { filePath: string, property: string }) => {
    const file = app.vault.getFileByPath(args.filePath)
    const value: unknown = file ? app.metadataCache.getFileCache(file)?.frontmatter?.[args.property] : undefined
    return value
  }, { filePath, property })
}

test.describe('script-hook execution', () => {
  test.beforeEach(async ({ obsidianPage: { page, vaultPath } }) => {
    const note = createNote(TASK_PATH, { type: 'work', sessions: 3 })
    const writeError = await writeNoteToVault(vaultPath, note)
    expect(writeError).toBeUndefined()

    await expect.poll(() => readFrontmatterValue(page, TASK_PATH, 'sessions')).toBe(3)
  })

  test('a bound script fires on real phase completion, reads the enriched activeFileFrontmatter, and its FileMutation is applied', async ({ obsidianPage: { page } }) => {
    await registerScriptHookBinding(
      page,
      HOOK_NAME,
      'return [{ kind: \'frontmatter\', filePath: context.activeFilePath, property: \'sessions\', value: context.activeFileFrontmatter.sessions + 1 }];',
    )
    await pointFocusOnCompleteAt(page, HOOK_NAME)
    await dispatchAction(page, { type: 'start', filePath: TASK_PATH })

    await completeFocusPhase(page)

    await expect.poll(() => readFrontmatterValue(page, TASK_PATH, 'sessions')).toBe(4)
  })

  test('a script that throws does not block the dispatch or leave the phase stuck', async ({ obsidianPage: { page } }) => {
    await registerScriptHookBinding(page, HOOK_NAME, 'throw new Error(\'e2e script failure\');')
    await pointFocusOnCompleteAt(page, HOOK_NAME)
    await dispatchAction(page, { type: 'start', filePath: TASK_PATH })

    await completeFocusPhase(page)

    await expect.poll(() => readFrontmatterValue(page, TASK_PATH, 'sessions')).toBe(3) // unchanged -- the throwing script applied nothing, but didn't hang dispatch either
  })
})
