import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { selectBasesSubView } from './helpers/bases'

const PLUGIN_ID = 'routine-flow'

test.describe('routine replace confirmation modal', () => {
  test.beforeEach(async ({ obsidianPage: { page } }) => {
    await expect.poll(async () =>
      evaluateObsidian(
        page,
        (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
        { pluginId: PLUGIN_ID },
      ),
    ).toBe(true)

    // .obsidian/workspace.json is gitignored -- open Tasks.base and select the "Default"
    // sub-view explicitly rather than relying on a persisted leaf (e2e-bases-view-testing-gotchas).
    await evaluateObsidian(page, async (app) => {
      const file = app.vault.getFileByPath('Tasks.base')
      if (!file) {
        throw new Error('Tasks.base not found')
      }
      const leaf = app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')
      await leaf.openFile(file)
    })
    await selectBasesSubView(page, 'Default')

    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    await expect(view).toHaveAttribute('data-view-graph-id', 'default')

    // Start the default routine so the engine has a running session before switching
    // to a different routine below -- decideStartAction only confirms when a session is in
    // progress on a different graph (src/timer/routine-selection.ts).
    await page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls').getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel h2')).toHaveText(/^Focus: \d{2}:\d{2} \(running\)$/)

    // Switch to the "Workout" sub-view (routines/workout-routine.md, graph id "workout") while
    // the default routine is still running -- wait for its own async routine-file load to
    // settle before the tests below click Start against it (flow-6v7).
    await selectBasesSubView(page, 'Workout')
    await expect(view).toHaveAttribute('data-view-graph-id', 'workout')
  })

  test('cancelling leaves the running routine untouched', async ({ obsidianPage: { page } }) => {
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')

    await controls.getByRole('button', { name: 'Start' }).click()
    const modal = page.locator('.modal').filter({ hasText: 'Replace running routine?' })
    await expect(modal).toBeVisible()

    await modal.getByRole('button', { name: 'Cancel' }).click()
    await expect(modal).toBeHidden()

    // Still showing the Workout sub-view, but the default routine remains the active one.
    await expect(panel.locator('.routine-inert'))
      .toHaveText('"Default routine" is currently active instead of this view\'s routine ("Workout").')
  })

  test('replacing switches the active graph and starts it', async ({ obsidianPage: { page } }) => {
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')

    await controls.getByRole('button', { name: 'Start' }).click()
    const modal = page.locator('.modal').filter({ hasText: 'Replace running routine?' })
    await expect(modal).toBeVisible()

    await modal.getByRole('button', { name: 'Replace' }).click()
    await expect(modal).toBeHidden()

    await expect(panel.locator('h2')).toHaveText(/^Warm-up: \d{2}:\d{2} \(running\)$/)
  })
})
