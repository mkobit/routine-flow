/**
 * Regenerates docs-site screenshots (docs/static/img/screenshots/) of the plugin's running
 * states. Not part of the regression suite -- run explicitly via its dedicated config:
 *   xvfb-run --auto-servernum --server-args="-screen 0 1280x1024x24" \
 *     bunx playwright test --config=e2e/capture-screenshots.playwright.config.ts
 * (or `bun run docs:screenshots`). Follows the fixture/setup patterns of timer.e2e.ts,
 * side-panel.e2e.ts, status-bar.e2e.ts, write-back-modal.e2e.ts and
 * routine-replace-modal.e2e.ts.
 */
import type { Page } from '@playwright/test'
import * as path from 'node:path'
import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { createNote, writeNoteToVault } from './vault'
import type { EngineAction } from '../src/timer/reducer'

const PLUGIN_ID = 'routine-flow'
const SCREENSHOT_DIR = path.resolve(import.meta.dirname, '../docs/static/img/screenshots')

function shot(name: string): string {
  return path.join(SCREENSHOT_DIR, name)
}

function dispatchAction(page: Page, action: EngineAction): Promise<unknown> {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID, action: EngineAction }) =>
    app.plugins.plugins[args.pluginId]!.store.dispatch(args.action), { pluginId: PLUGIN_ID, action })
}

async function waitForPluginReady(page: Page): Promise<void> {
  await expect.poll(async () =>
    evaluateObsidian(
      page,
      (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
      { pluginId: PLUGIN_ID },
    ),
  ).toBe(true)
}

async function openDefaultBasesView(page: Page): Promise<void> {
  await evaluateObsidian(page, async (app) => {
    const file = app.vault.getFileByPath('Tasks.base')
    if (!file) {
      throw new Error('Tasks.base not found')
    }
    const leaf = app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')
    await leaf.openFile(file)
  })
  await page.locator('.workspace-leaf-content[data-type="bases"] .bases-toolbar-views-menu .text-icon-button').click()
  await page.locator('.menu .bases-toolbar-menu-item-name', { hasText: 'Default' }).click()
}

test.describe('capture screenshots for docs', () => {
  test('Bases timer view -- idle and running', async ({ obsidianPage: { page } }) => {
    await waitForPluginReady(page)
    await openDefaultBasesView(page)

    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    await expect(view).toHaveAttribute('data-view-graph-id', 'default')

    await page.screenshot({ path: shot('timer-idle.png') })

    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Focus: \d{2}:\d{2} \(running\)$/)

    await page.screenshot({ path: shot('timer-running.png') })
  })

  test('side panel and status bar', async ({ obsidianPage: { page } }) => {
    await waitForPluginReady(page)
    await dispatchAction(page, { type: 'stop' })

    // Start via the Bases view (not a bare dispatchAction) so the side panel's Work queue is
    // populated with real BaseQuerySource-backed tasks instead of "No tasks found." -- also
    // leaves the main pane showing the Bases view instead of a blank "New tab".
    await openDefaultBasesView(page)
    await page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls').getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel h2')).toHaveText(/^Focus: \d{2}:\d{2} \(running\)$/)

    await page.locator('.side-dock-ribbon-action[aria-label="Open routine panel"]').click()
    const panel = page.locator('.routine-side-panel')
    await expect(panel.locator('h2')).toHaveText(/^Focus: \d{2}:\d{2} \(running\)$/)
    await expect(panel.locator('.routine-queue li').first()).toBeVisible()

    await page.screenshot({ path: shot('side-panel.png') })

    const statusBarItem = page.locator('.routine-status-bar-item')
    await expect(statusBarItem).toBeVisible()
    await page.locator('.status-bar').screenshot({ path: shot('status-bar.png') })
  })

  test('settings tab', async ({ obsidianPage: { page } }) => {
    await waitForPluginReady(page)
    await evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID }) => {
      app.setting.open()
      app.setting.openTabById(args.pluginId)
    }, { pluginId: PLUGIN_ID })
    await expect(page.locator('.modal.mod-settings')).toBeVisible()
    await page.screenshot({ path: shot('settings-tab.png') })
  })

  test('write-back confirmation modal', async ({ obsidianPage: { page, vaultPath } }) => {
    const TASK_PATH = 'screenshot-write-back-task.md'
    await waitForPluginReady(page)
    const note = createNote(TASK_PATH, { type: 'work', sessions: 3 })
    const writeError = await writeNoteToVault(vaultPath, note)
    expect(writeError).toBeUndefined()

    await expect.poll(() =>
      evaluateObsidian(page, (app, args: { path: string }) => {
        const file = app.vault.getFileByPath(args.path)
        const value: unknown = file ? app.metadataCache.getFileCache(file)?.frontmatter?.sessions : undefined
        return value
      }, { path: TASK_PATH }),
    ).toBe(3)

    await dispatchAction(page, { type: 'start', filePath: TASK_PATH })

    // Drive the focus phase to real completion via simulated ticks (not wall-clock waits) --
    // mirrors write-back-modal.e2e.ts's completeFocusPhase. The final tick fires the write-back
    // hook and is deliberately not awaited (its promise doesn't resolve until the modal below is
    // dismissed).
    await dispatchAction(page, { type: 'pause' })
    await evaluateObsidian(page, async (app, args: { pluginId: typeof PLUGIN_ID }) => {
      const store = app.plugins.plugins[args.pluginId]!.store
      const remainingSeconds = store.getState().remaining?.total({ unit: 'seconds' }) ?? 0
      for (let i = 0; i < remainingSeconds; i += 1) {
        await store.dispatch({ type: 'tick' })
      }
    }, { pluginId: PLUGIN_ID })
    void dispatchAction(page, { type: 'tick' })

    const modal = page.locator('.modal').filter({ hasText: 'Confirm write-back' })
    await expect(modal).toBeVisible()

    // The File field auto-focuses on open and its AbstractInputSuggest immediately shows a
    // suggestion dropdown that obscures the Property field below -- blur it onto the modal
    // title (a plain, non-interactive element) before capturing so the whole form is visible.
    await modal.locator('.modal-title').click()
    await expect(modal.locator('.suggestion-container')).toBeHidden()

    await page.screenshot({ path: shot('write-back-modal.png') })

    // Dismiss so Obsidian shutdown doesn't hang on the outstanding write-back promise.
    await modal.getByRole('button', { name: 'Cancel' }).click()
  })

  test('routine-replace confirmation modal', async ({ obsidianPage: { page } }) => {
    await waitForPluginReady(page)
    await openDefaultBasesView(page)
    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    await expect(view).toHaveAttribute('data-view-graph-id', 'default')

    await page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls').getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel h2')).toHaveText(/^Focus: \d{2}:\d{2} \(running\)$/)

    await page.locator('.workspace-leaf-content[data-type="bases"] .bases-toolbar-views-menu .text-icon-button').click()
    await page.locator('.menu .bases-toolbar-menu-item-name', { hasText: 'Workout' }).click()
    await expect(view).toHaveAttribute('data-view-graph-id', 'workout')

    await page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls').getByRole('button', { name: 'Start' }).click()
    const modal = page.locator('.modal').filter({ hasText: 'Replace running routine?' })
    await expect(modal).toBeVisible()

    await page.screenshot({ path: shot('routine-replace-modal.png') })

    await modal.getByRole('button', { name: 'Cancel' }).click()
  })
})
