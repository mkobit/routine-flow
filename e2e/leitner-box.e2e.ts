import type { Page } from '@playwright/test'
import { Temporal } from 'temporal-polyfill'
import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { selectBasesSubView } from './helpers/bases'

function readCardFrontmatter(page: Page, path: string): Promise<Record<string, unknown> | undefined> {
  return evaluateObsidian(page, (app, args: { path: string }) => {
    const file = app.vault.getFileByPath(args.path)
    return file ? app.metadataCache.getFileCache(file)?.frontmatter : undefined
  }, { path })
}

test.describe('Leitner box review flow and queue advancement (flow-ccb.5)', () => {
  test.beforeEach(async ({ obsidianPage: { page } }) => {
    await evaluateObsidian(page, async (app) => {
      const file = app.vault.getFileByPath('Tasks.base')
      if (!file) {
        throw new Error('Tasks.base not found')
      }
      const leaf = app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')
      await leaf.openFile(file)
    })
    await selectBasesSubView(page, 'Leitner box review')
  })

  test('renders Leitner box review queue and grade action buttons on active card', async ({ obsidianPage: { page } }) => {
    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')
    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .routine-queue')

    await expect(view).toHaveAttribute('data-view-graph-id', 'leitner-box')

    // Start Leitner box review routine
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText('Card review (running)')

    // Verify queue items render
    const items = queue.locator('li .routine-task-name')
    await expect(items.first()).toBeVisible()

    // Select the first due card
    const firstItem = queue.locator('li').first()
    await firstItem.locator('.routine-task-name').click()
    await expect(firstItem).toHaveClass(/is-active-task/)

    // Verify all 4 grade action buttons render on active card with expected styling
    const actions = firstItem.locator('.routine-queue-actions button')
    await expect(actions).toHaveCount(4)

    const againBtn = actions.filter({ hasText: 'Again (10m)' })
    await expect(againBtn).toBeVisible()
    await expect(againBtn).toHaveClass(/mod-warning/)

    const hardBtn = actions.filter({ hasText: 'Hard (1d)' })
    await expect(hardBtn).toBeVisible()

    const goodBtn = actions.filter({ hasText: 'Good (3d)' })
    await expect(goodBtn).toBeVisible()
    await expect(goodBtn).toHaveClass(/mod-cta/)

    const easyBtn = actions.filter({ hasText: 'Easy (7d)' })
    await expect(easyBtn).toBeVisible()
  })

  test('clicking Good mutates frontmatter to deferred with future date and auto-advances queue', async ({ obsidianPage: { page } }) => {
    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')
    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .routine-queue')

    await expect(view).toHaveAttribute('data-view-graph-id', 'leitner-box')

    // Start routine
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText('Card review (running)')

    // Select first card
    const firstItem = queue.locator('li').first()
    const firstCardName = await firstItem.locator('.routine-task-name').innerText()
    await firstItem.locator('.routine-task-name').click()
    await expect(firstItem).toHaveClass(/is-active-task/)

    const firstCardPath = `leitner-box/${firstCardName}.md`

    // Verify initial frontmatter of first card
    const initialFrontmatter = await readCardFrontmatter(page, firstCardPath)
    expect(initialFrontmatter).toBeDefined()

    // Click "Good (3d)" action
    const goodBtn = firstItem.locator('.routine-queue-actions button').filter({ hasText: 'Good (3d)' })
    await expect(goodBtn).toBeVisible()
    await goodBtn.click()

    // Verify frontmatter mutation: routine-status becomes deferred, box becomes 3, routine-due is in the future
    await expect.poll(async () => {
      const fm = await readCardFrontmatter(page, firstCardPath)
      return fm?.['routine-status']
    }).toBe('deferred')

    await expect.poll(async () => {
      const fm = await readCardFrontmatter(page, firstCardPath)
      return fm?.['box']
    }).toBe(3)

    const updatedFrontmatter = await readCardFrontmatter(page, firstCardPath)
    const dueRaw = updatedFrontmatter?.['routine-due']
    expect(typeof dueRaw).toBe('string')
    const dueInstant = Temporal.Instant.from(String(dueRaw))
    const nowInstant = Temporal.Now.instant()
    expect(Temporal.Instant.compare(dueInstant, nowInstant)).toBeGreaterThan(0)

    // Verify queue auto-advances: reviewed card is removed from due queue, next card becomes active
    await expect(queue.locator('li.is-active-task .routine-task-name')).not.toHaveText(firstCardName)
    const secondCard = queue.locator('li.is-active-task')
    await expect(secondCard).toBeVisible()
    const secondCardName = await secondCard.locator('.routine-task-name').innerText()
    expect(secondCardName.length).toBeGreaterThan(0)
    expect(secondCardName).not.toBe(firstCardName)

    // Verify next active card also renders review grade actions
    const secondActions = secondCard.locator('.routine-queue-actions button')
    await expect(secondActions.filter({ hasText: 'Good (3d)' })).toBeVisible()

    // Grade second card with "Again (10m)" to verify box 1 demotion and rapid sequential auto-advance
    const secondCardPath = `leitner-box/${secondCardName}.md`
    const againBtn = secondActions.filter({ hasText: 'Again (10m)' })
    await expect(againBtn).toBeVisible()
    await againBtn.click()

    await expect.poll(async () => {
      const fm = await readCardFrontmatter(page, secondCardPath)
      return fm?.['routine-status']
    }).toBe('deferred')

    await expect.poll(async () => {
      const fm = await readCardFrontmatter(page, secondCardPath)
      return fm?.['box']
    }).toBe(1)

    // Queue auto-advances again to third card
    await expect(queue.locator('li.is-active-task .routine-task-name')).not.toHaveText(secondCardName)
    const thirdCard = queue.locator('li.is-active-task')
    await expect(thirdCard).toBeVisible()
    const thirdCardName = await thirdCard.locator('.routine-task-name').innerText()
    expect(thirdCardName.length).toBeGreaterThan(0)
    expect(thirdCardName).not.toBe(secondCardName)
    expect(thirdCardName).not.toBe(firstCardName)
  })
})
