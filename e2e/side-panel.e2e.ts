import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { selectBasesSubView } from './helpers/bases'
import type { EngineAction } from '../src/timer/reducer'

const PLUGIN_ID = 'routine-flow'
const RIBBON_ICON = '.side-dock-ribbon-action[aria-label="Open routine panel"]'

function dispatchAction(page: Page, action: EngineAction): Promise<unknown> {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID, action: EngineAction }) =>
    app.plugins.plugins[args.pluginId]!.store.dispatch(args.action), { pluginId: PLUGIN_ID, action })
}

function panelOf(page: Page) {
  return page.locator('.routine-side-panel')
}

test.describe('workspace-wide side panel view', () => {
  test.beforeEach(async ({ obsidianPage: { page } }) => {
    await expect.poll(async () =>
      evaluateObsidian(
        page,
        (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
        { pluginId: PLUGIN_ID },
      ),
    ).toBe(true)
    await dispatchAction(page, { type: 'stop' })
  })

  test('opens via ribbon icon, shows the idle placeholder, and reuses the same leaf on a second click', async ({ obsidianPage: { page } }) => {
    await page.locator(RIBBON_ICON).click()
    const panel = panelOf(page)
    await expect(panel).toHaveText(/No routine is running/)
    await expect(panel.locator('.routine-controls')).toHaveCount(0)
    await expect(panel.locator('.routine-queue')).toHaveCount(0)

    await page.locator(RIBBON_ICON).click()
    await expect(page.locator('.workspace-leaf-content[data-type="routine-side-panel"]')).toHaveCount(1)
  })

  test('pause/resume/reset controls reflect and drive the shared engine state', async ({ obsidianPage: { page } }) => {
    await page.locator(RIBBON_ICON).click()
    const panel = panelOf(page)
    const header = panel.locator('h2')
    const controls = panel.locator('.routine-controls')

    await dispatchAction(page, { type: 'start' })
    await expect(header).toHaveText(/^Focus: \d{2}:\d{2} \(running\)$/)

    await controls.getByRole('button', { name: 'Pause' }).click()
    await expect(header).toHaveText(/\(paused\)$/)

    await controls.getByRole('button', { name: 'Resume' }).click()
    await expect(header).toHaveText(/\(running\)$/)

    await controls.getByRole('button', { name: 'Reset' }).click()
    const resetModal = page.locator('.modal').filter({ hasText: 'Reset routine?' })
    await expect(resetModal).toBeVisible()
    await resetModal.getByRole('button', { name: 'Reset' }).click()
    await expect(resetModal).toBeHidden()

    await expect(panel).toHaveText(/No routine is running/)
  })

  test('cancelling the reset confirmation leaves the routine running', async ({ obsidianPage: { page } }) => {
    await page.locator(RIBBON_ICON).click()
    const panel = panelOf(page)
    const header = panel.locator('h2')
    const controls = panel.locator('.routine-controls')

    await dispatchAction(page, { type: 'start' })
    await expect(header).toHaveText(/^Focus: \d{2}:\d{2} \(running\)$/)

    await controls.getByRole('button', { name: 'Reset' }).click()
    const resetModal = page.locator('.modal').filter({ hasText: 'Reset routine?' })
    await expect(resetModal).toBeVisible()
    await resetModal.getByRole('button', { name: 'Cancel' }).click()
    await expect(resetModal).toBeHidden()

    await expect(header).toHaveText(/^Focus: \d{2}:\d{2} \(running\)$/)
  })

  test('a routine started from a Bases timer view appears in the panel', async ({ obsidianPage: { page } }) => {
    await page.locator(RIBBON_ICON).click()
    const panel = panelOf(page)
    await expect(panel).toHaveText(/No routine is running/)

    await evaluateObsidian(page, async (app) => {
      const file = app.vault.getFileByPath('Tasks.base')
      if (!file) {
        throw new Error('Tasks.base not found')
      }
      const leaf = app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')
      await leaf.openFile(file)
    })
    await selectBasesSubView(page, 'Default')

    await page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls').getByRole('button', { name: 'Start' }).click()

    await expect(panel.locator('h2')).toHaveText(/^Focus: \d{2}:\d{2} \(running\)$/)
  })

  test('queue items are listed with the active item highlighted, and clicking one switches the active file', async ({ obsidianPage: { page } }) => {
    // Populate the focus-queue TaskSource via Tasks.base's "Default" sub-view, same setup as
    // timer.e2e.ts's BaseQuerySource-backed queue test.
    await evaluateObsidian(page, async (app) => {
      const file = app.vault.getFileByPath('Tasks.base')
      if (!file) {
        throw new Error('Tasks.base not found')
      }
      const leaf = app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')
      await leaf.openFile(file)
    })
    await selectBasesSubView(page, 'Default')

    await page.locator(RIBBON_ICON).click()
    await dispatchAction(page, { type: 'start' })

    const panel = panelOf(page)
    const queue = panel.locator('.routine-queue')
    await expect(queue.locator('h3')).toHaveText('Work queue', { timeout: 20_000 })

    const items = queue.locator('li')
    await expect(items.first()).not.toHaveClass(/is-active-task/)

    await items.first().locator('button').click()
    await expect(items.first()).toHaveClass(/is-active-task/)
  })
})
