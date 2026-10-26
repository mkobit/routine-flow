import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { selectBasesSubView } from './helpers/bases'

const PLUGIN_ID = 'routine-flow'

function readStoreState(page: Page) {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID }) => {
    const store = app.plugins.plugins[args.pluginId]!.store
    const state = store.getState()
    return {
      status: state.status,
      currentPhaseId: String(state.currentPhaseId),
      queueExhausted: state.queueExhausted,
      historyLength: state.session?.history.length ?? 0,
      lastHistoryEndReason: state.session?.history.at(-1)?.endReason,
      lastHistoryItemsTouched: state.session?.history.at(-1)?.itemsTouched.map(touch => ({
        sourcePath: touch.sourcePath,
        status: touch.status,
      })) ?? [],
    }
  }, { pluginId: PLUGIN_ID })
}

function readChoreFrontmatter(page: Page, path: string): Promise<Record<string, unknown> | undefined> {
  return evaluateObsidian(page, (app, args: { path: string }) => {
    const file = app.vault.getFileByPath(args.path)
    return file ? app.metadataCache.getFileCache(file)?.frontmatter : undefined
  }, { path })
}

test.describe('Chore blitz execution (flow-xne.6)', () => {
  test.beforeEach(async ({ obsidianPage: { page } }) => {
    await evaluateObsidian(page, async (app) => {
      const file = app.vault.getFileByPath('Tasks.base')
      if (!file) {
        throw new Error('Tasks.base not found')
      }
      const leaf = app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')
      await leaf.openFile(file)
    })
    await selectBasesSubView(page, 'Chore blitz')
  })

  test('renders chore queue, dynamic completed chore counter badge, and active task markDone action', async ({ obsidianPage: { page } }) => {
    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')
    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .routine-queue')

    await expect(view).toHaveAttribute('data-view-graph-id', 'chore-blitz')

    // Start chore blitz routine
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Chore blitz sprint: \d{2}:\d{2} \(running\)$/)

    // Queue header title and counter badge
    await expect(queue.locator('.routine-queue-header h3')).toHaveText('Work queue')
    const counterBadge = queue.locator('.routine-queue-completed-badge')
    await expect(counterBadge).toBeVisible()
    await expect(counterBadge).toHaveText('0 chores completed')

    // Queue tasks rendering and selecting active chore
    const items = queue.locator('li .routine-task-name')
    await expect(items).toHaveCount(3)

    const firstItem = queue.locator('li').first()
    await firstItem.locator('.routine-task-name').click()
    await expect(firstItem).toHaveClass(/is-active-task/)

    const doneButton = firstItem.locator('.routine-queue-actions button').filter({ hasText: 'Done' })
    await expect(doneButton).toBeVisible()
    await expect(doneButton).toHaveClass(/mod-cta/)
  })

  test('rapid sequential markDone interactions advance selection, increment live counter, and transition early to wrap-up on queue exhaustion', async ({ obsidianPage: { page } }) => {
    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')
    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .routine-queue')

    await expect(view).toHaveAttribute('data-view-graph-id', 'chore-blitz')

    // Start chore blitz routine
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Chore blitz sprint: \d{2}:\d{2} \(running\)$/)

    const counterBadge = queue.locator('.routine-queue-completed-badge')
    await expect(counterBadge).toHaveText('0 chores completed')

    // Activate the first chore
    await queue.locator('li .routine-task-name').first().click()

    // 1. Mark first chore done
    await expect(queue.locator('li.is-active-task .routine-task-name')).toHaveText('01-wipe-kitchen-counters')
    const doneBtn1 = queue.locator('li.is-active-task .routine-queue-actions button').filter({ hasText: 'Done' })
    await expect(doneBtn1).toBeVisible()
    await doneBtn1.click()

    // Immediate counter increment and active selection advancement to second chore
    await expect(counterBadge).toHaveText('1 chore completed')
    await expect(queue.locator('li.is-active-task .routine-task-name')).toHaveText('02-fold-clean-laundry')

    // 2. Mark second chore done
    const doneBtn2 = queue.locator('li.is-active-task .routine-queue-actions button').filter({ hasText: 'Done' })
    await expect(doneBtn2).toBeVisible()
    await doneBtn2.click()

    // Immediate counter increment and active selection advancement to third chore
    await expect(counterBadge).toHaveText('2 chores completed')
    await expect(queue.locator('li.is-active-task .routine-task-name')).toHaveText('03-empty-dishwasher')

    // 3. Mark third (final) chore done
    const doneBtn3 = queue.locator('li.is-active-task .routine-queue-actions button').filter({ hasText: 'Done' })
    await expect(doneBtn3).toBeVisible()
    await doneBtn3.click()

    // Automated phase transition to wrap-up prior to 15-minute timer countdown expiry
    await expect(panel.locator('h2')).toHaveText(/^Clean-up and wrap-up: \d{2}:\d{2} \(stopped\)$/, { timeout: 15_000 })

    // Celebration message renders on early queue exhaustion
    const celebration = panel.locator('.routine-blitz-celebration-text')
    await expect(celebration).toBeVisible()
    await expect(celebration).toHaveText('All chores completed early!')

    // Notice toast alerts user of early completion
    await expect(page.locator('.notice').filter({ hasText: 'Routine Flow: Blitz completed early — all tasks finished' })).toBeVisible()

    // Verify domain store state: phase advanced to wrap-up, queueExhausted marked, endReason completed
    const state = await readStoreState(page)
    expect(state.currentPhaseId).toBe('wrap-up')
    expect(state.status).toBe('stopped')
    expect(state.queueExhausted).toBe(true)
    expect(state.lastHistoryEndReason).toBe('completed')
    expect(state.lastHistoryItemsTouched).toHaveLength(3)
    for (const touch of state.lastHistoryItemsTouched) {
      expect(touch.status).toBe('completed')
      const frontmatter = await readChoreFrontmatter(page, touch.sourcePath)
      expect(frontmatter?.['routine-status']).toBe('done')
    }
  })
})
