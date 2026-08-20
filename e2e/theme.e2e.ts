import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { selectBasesSubView } from './helpers/bases'
import type { EngineAction } from '../src/timer/reducer'
import type { ProgressMeterStyle } from '../src/timer/progress-meter-style'

const PLUGIN_ID = 'routine-flow'

function dispatchAction(page: Page, action: EngineAction): Promise<unknown> {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID, action: EngineAction }) =>
    app.plugins.plugins[args.pluginId]!.store.dispatch(args.action), { pluginId: PLUGIN_ID, action })
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
  await selectBasesSubView(page, 'Default')
}

async function controlsClick(page: Page, name: string): Promise<void> {
  await page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls').getByRole('button', { name }).click()
}

async function applyProgressMeterStyle(page: Page, style: ProgressMeterStyle): Promise<void> {
  await evaluateObsidian(page, async (app, args: { pluginId: typeof PLUGIN_ID, style: ProgressMeterStyle }) => {
    const plugin = app.plugins.plugins[args.pluginId]!
    const updatedSettings = {
      ...plugin.settings,
      progressMeterStyle: args.style,
    }
    // eslint-disable-next-line functional/immutable-data -- mutating plugin runtime settings in e2e test
    plugin.settings = updatedSettings
    await plugin.saveSettings()
    await plugin.store.dispatch({ type: 'pause' })
    await plugin.store.dispatch({ type: 'stop' })
  }, { pluginId: PLUGIN_ID, style })
}

test.describe('Theme adaptability and CSS styling', () => {
  test('inherits theme variables and renders base container classes', async ({ obsidianPage: { page } }) => {
    await openDefaultBasesView(page)

    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    await expect(view).toBeVisible()
    await expect(view).toHaveClass(/routine-timer-view/)

    const timerPanel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    await expect(timerPanel).toBeVisible()
    await expect(timerPanel).toHaveClass(/routine-timer-panel/)
    await expect(timerPanel).toHaveClass(/is-stopped/)

    // Verify SVG progress ring is rendered with track and indicator
    const ring = timerPanel.locator('svg.routine-progress-ring')
    await expect(ring).toBeVisible()
    await expect(ring.locator('.routine-progress-track')).toBeVisible()
    await expect(ring.locator('.routine-progress-indicator')).toBeVisible()
  })

  test('applies is-running and is-paused state classes across timer and status bar', async ({ obsidianPage: { page } }) => {
    await openDefaultBasesView(page)

    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')
    const timerPanel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const statusBarItem = page.locator('.routine-status-bar-item')

    // Start routine
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(timerPanel).toHaveClass(/is-running/)
    await expect(statusBarItem).toHaveClass(/is-running/)

    // Pause routine
    await controls.getByRole('button', { name: 'Pause' }).click()
    await expect(timerPanel).toHaveClass(/is-paused/)
    await expect(statusBarItem).toHaveClass(/is-paused/)

    // Clean up
    await dispatchAction(page, { type: 'stop' })
    await expect(timerPanel).toHaveClass(/is-stopped/)
  })

  test('supports progress meter style class toggles on dial', async ({ obsidianPage: { page } }) => {
    await openDefaultBasesView(page)

    const dial = page.locator('.workspace-leaf-content[data-type="bases"] .routine-countdown-dial')
    await expect(dial).toBeVisible()

    // Test switching progress meter styles in plugin settings
    for (const style of ['fill-bar', 'battery-drain', 'tick-marks', 'radial'] as const) {
      await applyProgressMeterStyle(page, style)

      if (style === 'radial') {
        await expect(dial).not.toHaveClass(/routine-progress-style-/)
        await expect(dial.locator('.routine-progress-ring')).toBeVisible()
      }
      else {
        await expect(dial).toHaveClass(new RegExp(`routine-progress-style-${style}`))
        await expect(dial.locator(`.routine-progress-${style}`)).toBeVisible()
      }
    }
  })

  test('side panel and modals carry scoped CSS root classes', async ({ obsidianPage: { page } }) => {
    await openDefaultBasesView(page)

    // Open side panel
    await page.locator('.side-dock-ribbon-action[aria-label="Open routine panel"]').click()
    const sidePanel = page.locator('.routine-side-panel')
    await expect(sidePanel).toBeVisible()

    // Trigger routine replace modal
    await controlsClick(page, 'Start')
    await selectBasesSubView(page, 'Workout')
    await controlsClick(page, 'Start')

    const replaceModal = page.locator('.modal.routine-replace-modal')
    await expect(replaceModal).toBeVisible()
    await expect(replaceModal.locator('.routine-replace-warning')).toBeVisible()
    await replaceModal.getByRole('button', { name: 'Cancel' }).click()

    await dispatchAction(page, { type: 'stop' })
  })
})
