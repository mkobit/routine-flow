import type { Page } from '@playwright/test'
import {
  test,
  expect,
  setMobileViewport,
  closeMobileSidebars,
} from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { selectBasesSubView } from './helpers/bases'
import { createNote, writeNoteToVault } from './vault'
import type { EngineAction } from '../src/timer/reducer'

const PLUGIN_ID = 'routine-flow'
const WRITE_BACK_TASK_PATH = 'mobile-write-back-task.md'

async function openTasksBase(page: Page): Promise<void> {
  await evaluateObsidian(page, async (app) => {
    const file = app.vault.getFileByPath('Tasks.base')
    if (!file) {
      throw new Error('Tasks.base not found')
    }
    const leaf = app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')
    await leaf.openFile(file)
    await app.workspace.revealLeaf(leaf)
  })
  await closeMobileSidebars(page)
}

function dispatchAction(page: Page, action: EngineAction): Promise<unknown> {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID, action: EngineAction }) =>
    app.plugins.plugins[args.pluginId]!.store.dispatch(args.action), { pluginId: PLUGIN_ID, action })
}

/**
 * Completes the running focus phase by stepping simulated ticks.
 * The final tick triggers the write-back modal and is not awaited to prevent deadlocking.
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
  void dispatchAction(page, { type: 'tick' })
}

function readSessionsValue(page: Page, taskPath: string = WRITE_BACK_TASK_PATH): Promise<unknown> {
  return evaluateObsidian(page, (app, args: { path: string }) => {
    const file = app.vault.getFileByPath(args.path)
    const value: unknown = file ? app.metadataCache.getFileCache(file)?.frontmatter?.sessions : undefined
    return value
  }, { path: taskPath })
}

function writeBackModalLocator(page: Page) {
  return page.locator('.modal').filter({ hasText: 'Confirm write-back' })
}

function replaceRoutineModalLocator(page: Page) {
  return page.locator('.modal').filter({ hasText: 'Replace running routine?' })
}

test.describe('mobile bases timer views on phone and tablet', () => {
  test('renders bases timer view and queue on phone viewport', async ({ mobileObsidianPage: { page } }) => {
    await openTasksBase(page)
    await selectBasesSubView(page, 'Default')

    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    await expect(view).toBeVisible()
    await expect(view).toHaveAttribute('data-view-graph-id', 'default')

    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    await expect(panel.locator('h2')).toHaveText(/^Focus: \d{2}:\d{2} \(stopped\)$/)
    await expect(panel.locator('.routine-next-phase')).toHaveText('Next: Short break')

    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .routine-queue')
    await expect(queue.locator('h3')).toHaveText('Work queue')
  })

  test('renders timer view and toggles inline configuration on tablet viewport', async ({ mobileObsidianPage: { page } }) => {
    await setMobileViewport(page, 'tablet')

    const bodyClasses = await page.evaluate(() => Array.from(document.body.classList))
    expect(bodyClasses).toContain('is-tablet')

    await openTasksBase(page)
    await selectBasesSubView(page, 'Default')

    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    await expect(view).toBeVisible()

    const configBtn = view.locator('.routine-config-toggle-btn')
    const configPanel = view.locator('.routine-config-panel')

    await expect(configBtn).toBeVisible()
    await expect(configPanel).not.toBeVisible()

    await configBtn.click()
    await expect(configPanel).toBeVisible()
    await expect(configBtn).toHaveClass(/is-active/)

    await configBtn.click()
    await expect(configPanel).not.toBeVisible()
    await expect(configBtn).not.toHaveClass(/is-active/)
  })
})

test.describe('mobile phase transitions', () => {
  test('starts, pauses, and advances routine phases on mobile', async ({ mobileObsidianPage: { page } }) => {
    await openTasksBase(page)
    await selectBasesSubView(page, 'Default')

    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')

    await controls.getByRole('button', { name: 'Start' }).click()
    await closeMobileSidebars(page)
    await expect(panel.locator('h2')).toHaveText(/^Focus: \d{2}:\d{2} \(running\)$/)

    await controls.getByRole('button', { name: 'Pause' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Focus: \d{2}:\d{2} \(paused\)$/)

    await dispatchAction(page, { type: 'advance-phase' })
    await expect(panel.locator('h2')).toHaveText(/^Short break: \d{2}:\d{2} \(stopped\)$/)

    await controls.getByRole('button', { name: 'Start' }).click()
    await closeMobileSidebars(page)
    await expect(panel.locator('h2')).toHaveText(/^Short break: \d{2}:\d{2} \(running\)$/)
  })

  test('completes duration-less phase using done control on mobile', async ({ mobileObsidianPage: { page } }) => {
    await openTasksBase(page)
    await selectBasesSubView(page, 'Workout')

    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')

    await expect(view).toHaveAttribute('data-view-graph-id', 'workout')

    await controls.getByRole('button', { name: 'Start' }).click()
    await closeMobileSidebars(page)
    await expect(panel.locator('h2')).toHaveText(/^Warm-up: \d{2}:\d{2} \(running\)$/)

    await dispatchAction(page, { type: 'advance-phase' })
    await expect(panel.locator('h2')).toHaveText('Set (stopped)')

    await controls.getByRole('button', { name: 'Start' }).click()
    await closeMobileSidebars(page)
    await expect(panel.locator('h2')).toHaveText('Set (running)')

    const doneButton = controls.getByRole('button', { name: 'Done' })
    await expect(doneButton).toBeVisible()
    await doneButton.click()

    await expect(panel.locator('h2')).toHaveText(/^Rest: \d{2}:\d{2} \(stopped\)$/)
  })
})

test.describe('mobile write-back confirmation modal', () => {
  test.beforeEach(async ({ mobileObsidianPage: { page, vaultPath } }) => {
    const note = createNote(WRITE_BACK_TASK_PATH, { type: 'work', sessions: 3 })
    const writeError = await writeNoteToVault(vaultPath, note)
    expect(writeError).toBeUndefined()

    await expect.poll(() => readSessionsValue(page)).toBe(3)
    await dispatchAction(page, { type: 'start', filePath: WRITE_BACK_TASK_PATH })
  })

  test('submits edited session value in mobile write-back modal', async ({ mobileObsidianPage: { page } }) => {
    await completeFocusPhase(page)

    const modal = writeBackModalLocator(page)
    await expect(modal).toBeVisible()
    expect(page.context().pages()).toHaveLength(1)

    await modal.getByRole('textbox', { name: 'Value' }).fill('42')
    await modal.getByRole('button', { name: 'Submit' }).click()

    await expect.poll(() => readSessionsValue(page)).toBe(42)
    await expect(modal).toBeHidden()
  })

  test('cancelling mobile write-back modal preserves note value', async ({ mobileObsidianPage: { page } }) => {
    await completeFocusPhase(page)

    const modal = writeBackModalLocator(page)
    await expect(modal).toBeVisible()
    expect(page.context().pages()).toHaveLength(1)

    await modal.getByRole('button', { name: 'Cancel' }).click()

    await expect.poll(() => readSessionsValue(page)).toBe(3)
    await expect(modal).toBeHidden()
  })
})

test.describe('mobile routine replace confirmation modal', () => {
  test.beforeEach(async ({ mobileObsidianPage: { page } }) => {
    await openTasksBase(page)
    await selectBasesSubView(page, 'Default')

    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    await expect(view).toHaveAttribute('data-view-graph-id', 'default')

    await page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls').getByRole('button', { name: 'Start' }).click()
    await closeMobileSidebars(page)
    await expect(page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel h2')).toHaveText(/^Focus: \d{2}:\d{2} \(running\)$/)

    await selectBasesSubView(page, 'Workout')
    await expect(view).toHaveAttribute('data-view-graph-id', 'workout')
  })

  test('cancelling replacement preserves running routine on mobile', async ({ mobileObsidianPage: { page } }) => {
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')

    await controls.getByRole('button', { name: 'Start' }).click()
    const modal = replaceRoutineModalLocator(page)
    await expect(modal).toBeVisible()
    expect(page.context().pages()).toHaveLength(1)

    await modal.getByRole('button', { name: 'Cancel' }).click()
    await expect(modal).toBeHidden()

    await expect(panel.locator('.routine-inert'))
      .toHaveText('"Default routine" is currently active instead of this view\'s routine ("Workout").')
  })

  test('confirming replacement switches to new routine on mobile', async ({ mobileObsidianPage: { page } }) => {
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')

    await controls.getByRole('button', { name: 'Start' }).click()
    const modal = replaceRoutineModalLocator(page)
    await expect(modal).toBeVisible()
    expect(page.context().pages()).toHaveLength(1)

    await modal.getByRole('button', { name: 'Replace' }).click()
    await expect(modal).toBeHidden()
    await closeMobileSidebars(page)

    await expect(panel.locator('h2')).toHaveText(/^Warm-up: \d{2}:\d{2} \(running\)$/)
  })
})
