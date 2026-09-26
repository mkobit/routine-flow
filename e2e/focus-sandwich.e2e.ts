import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { selectBasesSubView } from './helpers/bases'
import { createNote, writeNoteToVault } from './vault'
import type { EngineAction } from '../src/timer/reducer'

const PLUGIN_ID = 'routine-flow'
const TASK_PATH = 'focus-sandwich/focus-e2e-task.md'

function dispatchAction(page: Page, action: EngineAction): Promise<unknown> {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID, action: EngineAction }) =>
    app.plugins.plugins[args.pluginId]!.store.dispatch(args.action), { pluginId: PLUGIN_ID, action })
}

function readSessionsValue(page: Page): Promise<unknown> {
  return evaluateObsidian(page, (app, args: { path: string }) => {
    const file = app.vault.getFileByPath(args.path)
    const value: unknown = file ? app.metadataCache.getFileCache(file)?.frontmatter?.sessions : undefined
    return value
  }, { path: TASK_PATH })
}

function modalLocator(page: Page) {
  return page.locator('.modal').filter({ hasText: 'Confirm write-back' })
}

test.describe('Focus sandwich workflow', () => {
  test('drives full session through warm-up, timed focus countdown, and cooldown write-back modal', async ({ obsidianPage: { page, vaultPath } }) => {
    const note = createNote(TASK_PATH, { type: 'focus-sandwich-task', sessions: 2 })
    const writeError = await writeNoteToVault(vaultPath, note)
    expect(writeError).toBeUndefined()

    // Open Tasks.base in a bases leaf
    await evaluateObsidian(page, async (app) => {
      const file = app.vault.getFileByPath('Tasks.base')
      if (!file) {
        throw new Error('Tasks.base not found')
      }
      const leaf = app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')
      await leaf.openFile(file)
    })

    await selectBasesSubView(page, 'Focus sandwich')

    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')

    await expect(view).toHaveAttribute('data-view-graph-id', 'focus-sandwich')

    // Bind active file to our test note
    await dispatchAction(page, { type: 'set-active-file', filePath: TASK_PATH })

    // 1. Warm-up phase (untimed, manual clear)
    const startBtn = controls.getByRole('button', { name: 'Start' })
    await startBtn.click()

    await expect(panel.locator('h2')).toHaveText('Intention warm-up (running)')
    const doneBtn = controls.getByRole('button', { name: 'Done' })
    await expect(doneBtn).toBeVisible()

    // Complete warm-up via Done button
    await doneBtn.click()
    await expect(panel.locator('h2')).toHaveText('Intention warm-up (completed)')

    // Advance warm-up via Clear button
    const clearBtn = controls.getByRole('button', { name: 'Clear' })
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()

    // 2. Deep focus phase (timed, countdown dial)
    await expect(panel.locator('h2')).toHaveText(/^Deep focus: \d{2}:\d{2} \(stopped\)$/)
    await controls.getByRole('button', { name: 'Start' }).click()

    await expect(panel.locator('h2')).toHaveText(/^Deep focus: \d{2}:\d{2} \(running\)$/)
    const dial = panel.locator('.routine-countdown-dial')
    await expect(dial).toBeVisible()
    await expect(dial.locator('.routine-progress-ring')).toBeVisible()

    // Complete deep focus phase
    await dispatchAction(page, { type: 'finish-phase' })

    // 3. Cooldown phase (untimed, write-back modal)
    await expect(panel.locator('h2')).toHaveText('Cooldown reflection (stopped)')

    // Set active task file to record cooldown reflection write-back
    await dispatchAction(page, { type: 'set-active-file', filePath: TASK_PATH })

    await controls.getByRole('button', { name: 'Start' }).click()

    await expect(panel.locator('h2')).toHaveText('Cooldown reflection (running)')
    const cooldownDoneBtn = controls.getByRole('button', { name: 'Done' })
    await expect(cooldownDoneBtn).toBeVisible()

    // Click Done to complete cooldown and open write-back modal
    await cooldownDoneBtn.click()

    const modal = modalLocator(page)
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: 'Submit' }).click()

    // Verify write-back modal submission updated the note frontmatter
    await expect.poll(() => readSessionsValue(page)).toBe(3)

    // Verify Clear button finishes the terminal phase
    const cooldownClearBtn = controls.getByRole('button', { name: 'Clear' })
    await expect(cooldownClearBtn).toBeVisible()
    await cooldownClearBtn.click()

    // Session ended
    const finalStatus = await evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID }) => {
      const state = app.plugins.plugins[args.pluginId]!.store.getState()
      return state.status
    }, { pluginId: PLUGIN_ID })
    expect(finalStatus).toBe('ended')
  })
})
