import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { selectBasesSubView } from './helpers/bases'
import { PredicateNameSchema } from '../src/domain/hook/predicate'

function readTrackerStars(page: Page): Promise<unknown> {
  return evaluateObsidian(page, (app) => {
    const file = app.vault.getFileByPath('star-jar-economy/Star-Jar-Tracker.md')
    const value: unknown = file ? app.metadataCache.getFileCache(file)?.frontmatter?.stars : undefined
    return value
  })
}

test.describe('Reward economy execution (flow-pt9.7)', () => {
  test.beforeEach(async ({ obsidianPage: { page } }) => {
    // Open Star-Jar.base in a leaf
    await evaluateObsidian(page, async (app) => {
      const file = app.vault.getFileByPath('Star-Jar.base')
      if (!file) {
        throw new Error('Star-Jar.base not found')
      }
      const leaf = app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')
      await leaf.openFile(file)
    })
    await selectBasesSubView(page, 'Star jar routine')

    // Configure formula predicate in plugin:
    const predicateName = PredicateNameSchema.parse('star-jar-full')
    await evaluateObsidian(page, async (app, args: { predicateName: typeof predicateName }) => {
      const plugin = app.plugins.plugins['routine-flow']
      if (plugin) {
        plugin.formulaPredicateRegistry.setFormulas([
          { name: args.predicateName, formula: 'tracker.stars >= 15' },
        ])
        const file = app.vault.getFileByPath('star-jar-economy/Star-Jar-Tracker.md')
        if (file) {
          await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            // eslint-disable-next-line functional/immutable-data -- mutating frontmatter in e2e test
            fm.stars = 0
            // eslint-disable-next-line functional/immutable-data -- mutating frontmatter in e2e test
            fm.target = 15
          })
        }
      }
    }, { predicateName })
  })

  test('task completion and star accumulation', async ({ obsidianPage: { page } }) => {
    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')
    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .routine-queue')
    const nextPhase = panel.locator('.routine-next-phase')

    // Verify data-view-graph-id is 'star-jar'
    await expect(view).toHaveAttribute('data-view-graph-id', 'star-jar')

    // Verify initial stars in Star-Jar-Tracker.md is 0
    await expect.poll(() => readTrackerStars(page)).toBe(0)

    // Click Start button
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toContainText('(running)')

    // Verify queue has tasks with star badges
    const badges = queue.locator('.routine-queue-badge')
    await expect(badges.first()).toBeVisible()

    // Select a task in the queue (task with 1 star)
    const taskItem = queue.locator('li').first()
    await taskItem.locator('.routine-task-name').click()
    await expect(taskItem).toHaveClass(/is-active-task/)

    // Finish the focus phase by dispatching finish-phase to the plugin store via evaluateObsidian
    await evaluateObsidian(page, (app) => {
      const store = app.plugins.plugins['routine-flow']?.store
      return store?.dispatch({ type: 'finish-phase' })
    })

    // Verify panel h2 shows (completed)
    await expect(panel.locator('h2')).toContainText('(completed)')

    // Verify Star-Jar-Tracker.md frontmatter stars updated to 1
    await expect.poll(() => readTrackerStars(page)).toBe(1)

    // Verify nextPhase indicates short break
    await expect(nextPhase).toHaveText('Next: Short break')

    // Click Clear button
    const clearBtn = controls.getByRole('button', { name: 'Clear' })
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()

    // Verify panel transitions to Short break: ... (because 1 < 15)
    await expect(panel.locator('h2')).toContainText('Short break')
  })

  test('threshold transition to prize break and bank reset', async ({ obsidianPage: { page } }) => {
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')
    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .routine-queue')
    const nextPhase = panel.locator('.routine-next-phase')

    // Seed Star-Jar-Tracker.md with stars: 10
    await evaluateObsidian(page, async (app) => {
      const file = app.vault.getFileByPath('star-jar-economy/Star-Jar-Tracker.md')
      if (file) {
        await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
          // eslint-disable-next-line functional/immutable-data -- mutating frontmatter in e2e test
          fm.stars = 10
          // eslint-disable-next-line functional/immutable-data -- mutating frontmatter in e2e test
          fm.target = 15
        })
      }
    })
    await expect.poll(() => readTrackerStars(page)).toBe(10)

    // Start focus session
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toContainText('(running)')

    // Select a task in the queue worth 5 stars (nth(3))
    const task5Star = queue.locator('li').nth(3)
    await task5Star.locator('.routine-task-name').click()
    await expect(task5Star).toHaveClass(/is-active-task/)

    // Finish focus phase by dispatching finish-phase
    await evaluateObsidian(page, (app) => {
      const store = app.plugins.plugins['routine-flow']?.store
      return store?.dispatch({ type: 'finish-phase' })
    })

    // Verify Star-Jar-Tracker.md frontmatter stars is updated to 15 (10 + 5)
    await expect.poll(() => readTrackerStars(page)).toBe(15)

    // Verify nextPhase text is 'Next: Prize celebration break'
    await expect(nextPhase).toHaveText('Next: Prize celebration break')

    // Click Clear button
    const clearBtn = controls.getByRole('button', { name: 'Clear' })
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()

    // Verify panel shows Prize celebration break: ...
    await expect(panel.locator('h2')).toContainText('Prize celebration break')

    // Start prize celebration break, then finish it by dispatching finish-phase
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toContainText('(running)')

    await evaluateObsidian(page, (app) => {
      const store = app.plugins.plugins['routine-flow']?.store
      return store?.dispatch({ type: 'finish-phase' })
    })

    // Verify Star-Jar-Tracker.md frontmatter stars is reset to 0
    await expect.poll(() => readTrackerStars(page)).toBe(0)

    // Verify panel transitions back to Focus session: ...
    await expect(panel.locator('h2')).toContainText('Focus session')
  })
})
