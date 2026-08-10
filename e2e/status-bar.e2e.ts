import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import type { EngineAction } from '../src/timer/reducer'

const PLUGIN_ID = 'routine-flow'

function dispatchAction(page: Page, action: EngineAction): Promise<unknown> {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID, action: EngineAction }) =>
    app.plugins.plugins[args.pluginId]!.store.dispatch(args.action), { pluginId: PLUGIN_ID, action })
}

function statusOf(page: Page): Promise<unknown> {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID }) =>
    app.plugins.plugins[args.pluginId]!.store.getState().status, { pluginId: PLUGIN_ID })
}

test.describe('workspace-wide status bar item', () => {
  test.beforeEach(async ({ obsidianPage: { page } }) => {
    await dispatchAction(page, { type: 'stop' })
  })

  test('hidden while stopped, shows the active phase once running, and hides again on stop', async ({ obsidianPage: { page } }) => {
    const item = page.locator('.routine-status-bar-item')
    await expect(item).not.toBeVisible()

    await dispatchAction(page, { type: 'start' })
    await expect(item).toBeVisible()
    await expect(item).toHaveText(/^Focus: \d{2}:\d{2} \(running\)$/)

    await dispatchAction(page, { type: 'stop' })
    await expect(item).not.toBeVisible()
  })

  test('clicking toggles pause/resume', async ({ obsidianPage: { page } }) => {
    const item = page.locator('.routine-status-bar-item')
    await dispatchAction(page, { type: 'start' })
    await expect(item).toHaveText(/\(running\)$/)

    await item.click()
    await expect(item).toHaveText(/\(paused\)$/)
    expect(await statusOf(page)).toBe('paused')

    await item.click()
    await expect(item).toHaveText(/\(running\)$/)
    expect(await statusOf(page)).toBe('running')
  })
})
