import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { selectBasesSubView } from './helpers/bases'

test.describe('Structured review cadences execution (flow-1t1.6)', () => {
  test.beforeEach(async ({ obsidianPage: { page } }) => {
    // Open Review-Cadences.base and select Weekly GTD review sub-view
    await evaluateObsidian(page, async (app) => {
      const file = app.vault.getFileByPath('Review-Cadences.base')
      if (!file) {
        throw new Error('Review-Cadences.base not found')
      }
      const leaf = app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')
      await leaf.openFile(file)
    })
    await selectBasesSubView(page, 'Weekly GTD review')
  })

  test('renders stage progress meter, checklist guidance, and sequentially steps through inbox, project, and waiting-for queries', async ({ obsidianPage: { page } }) => {
    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')
    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .routine-queue')
    const stageProgress = page.locator('.workspace-leaf-content[data-type="bases"] .routine-stage-progress')
    const guidance = page.locator('.workspace-leaf-content[data-type="bases"] .routine-guidance-checklist')

    await expect(view).toHaveAttribute('data-view-graph-id', 'weekly-gtd')

    // Start Phase 1 (Inbox review) to initialize and bind the weekly-gtd routine graph
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Process inbox to zero: \d{2}:\d{2} \(running\)$/)

    // Stage progress stepper verification for Phase 1
    const steps = stageProgress.locator('.routine-stage-stepper .routine-stage-step')
    await expect(steps).toHaveCount(5)
    await expect(steps.nth(0)).toHaveClass(/is-active/)
    await expect(steps.nth(0)).toHaveClass(/is-current/)
    await expect(steps.nth(0).locator('.routine-stage-step-label')).toHaveText('Process inbox to zero')
    await expect(steps.nth(1)).toHaveClass(/is-upcoming/)
    await expect(steps.nth(1).locator('.routine-stage-step-label')).toHaveText('Active project review')
    await expect(steps.nth(2)).toHaveClass(/is-upcoming/)
    await expect(steps.nth(2).locator('.routine-stage-step-label')).toHaveText('Waiting-for follow-ups')
    await expect(steps.nth(3)).toHaveClass(/is-upcoming/)
    await expect(steps.nth(3).locator('.routine-stage-step-label')).toHaveText('Someday and maybe review')
    await expect(steps.nth(4)).toHaveClass(/is-upcoming/)
    await expect(steps.nth(4).locator('.routine-stage-step-label')).toHaveText('Weekly commitments and focus')
    await expect(stageProgress.locator('.routine-stage-progress-indicator')).toHaveAttribute('style', /width:\s*0%/)

    // Interactive checklist guidance rendering and toggling
    await expect(guidance).toBeVisible()
    const guidanceItems = guidance.locator('.routine-guidance-item')
    await expect(guidanceItems).toHaveCount(3)
    await expect(guidanceItems.nth(0)).toContainText('Process all loose physical papers and notes')
    await expect(guidanceItems.nth(1)).toContainText('Triage email inboxes down to zero')
    await expect(guidanceItems.nth(2)).toContainText('Clarify and convert inbox tasks to next actions')

    const firstCheckbox = guidanceItems.first().locator('input.routine-guidance-checkbox')
    await expect(firstCheckbox).not.toBeChecked()
    await firstCheckbox.click()
    await expect(firstCheckbox).toBeChecked()
    await expect(guidanceItems.first()).toHaveClass(/is-checked/)

    // 1. Inbox queue items
    const inboxItems = queue.locator('li .routine-task-name')
    await expect(inboxItems).toHaveCount(3)
    await expect(inboxItems.nth(0)).toHaveText('01-sort-conference-notes-and-business-cards')
    await expect(inboxItems.nth(1)).toHaveText('02-sort-conference-notes-and-business-cards')
    await expect(inboxItems.nth(2)).toHaveText('03-review-customer-feedback-on-onboarding')

    // Advance to Phase 2 (Active project review)
    await evaluateObsidian(page, (app) => {
      const store = app.plugins.plugins['routine-flow']?.store
      return store?.dispatch({ type: 'advance-phase' })
    })
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Active project review: \d{2}:\d{2} \(running\)$/)

    // Stage progress updates for Phase 2
    await expect(steps.nth(0)).toHaveClass(/is-completed/)
    await expect(steps.nth(1)).toHaveClass(/is-active/)
    await expect(steps.nth(1)).toHaveClass(/is-current/)
    await expect(stageProgress.locator('.routine-stage-progress-indicator')).toHaveAttribute('style', /width:\s*20%/)

    // Guidance updates for Phase 2
    await expect(guidanceItems).toHaveCount(3)
    await expect(guidanceItems.nth(0)).toContainText('Confirm every active project has at least one next action')
    await expect(guidanceItems.nth(1)).toContainText('Archive completed projects')
    await expect(guidanceItems.nth(2)).toContainText('Identify blocked project deliverables')

    // 2. Active project queue items
    const projectItems = queue.locator('li .routine-task-name')
    await expect(projectItems).toHaveCount(3)
    await expect(projectItems.nth(0)).toHaveText('04-write-comprehensive-review-cadence-guide')
    await expect(projectItems.nth(1)).toHaveText('05-write-comprehensive-review-cadence-guide')
    await expect(projectItems.nth(2)).toHaveText('06-refactor-phase-transition-engine-store')

    // Advance to Phase 3 (Waiting-for follow-ups)
    await evaluateObsidian(page, (app) => {
      const store = app.plugins.plugins['routine-flow']?.store
      return store?.dispatch({ type: 'advance-phase' })
    })
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Waiting-for follow-ups: \d{2}:\d{2} \(running\)$/)

    // Stage progress updates for Phase 3
    await expect(steps.nth(0)).toHaveClass(/is-completed/)
    await expect(steps.nth(1)).toHaveClass(/is-completed/)
    await expect(steps.nth(2)).toHaveClass(/is-active/)
    await expect(steps.nth(2)).toHaveClass(/is-current/)
    await expect(stageProgress.locator('.routine-stage-progress-indicator')).toHaveAttribute('style', /width:\s*40%/)

    // Guidance updates for Phase 3
    await expect(guidanceItems).toHaveCount(3)
    await expect(guidanceItems.nth(0)).toContainText('Follow up on overdue delegated items')
    await expect(guidanceItems.nth(1)).toContainText('Record received updates')
    await expect(guidanceItems.nth(2)).toContainText('Archive resolved waiting-for items')

    // 3. Waiting queue items
    const waitingItems = queue.locator('li .routine-task-name')
    await expect(waitingItems).toHaveCount(3)
    await expect(waitingItems.nth(0)).toHaveText('07-design-system-asset-review-from-mike')
    await expect(waitingItems.nth(1)).toHaveText('08-legal-clearance-for-open-source-distribution')
    await expect(waitingItems.nth(2)).toHaveText('09-hardware-replacement-delivery-confirmation')

    // Advance to Phase 4 (Someday maybe ritual)
    await evaluateObsidian(page, (app) => {
      const store = app.plugins.plugins['routine-flow']?.store
      return store?.dispatch({ type: 'advance-phase' })
    })
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Someday and maybe review: \d{2}:\d{2} \(running\)$/)
    await expect(steps.nth(3)).toHaveClass(/is-active/)
    await expect(stageProgress.locator('.routine-stage-progress-indicator')).toHaveAttribute('style', /width:\s*60%/)

    // Advance to Phase 5 (Weekly planning ritual)
    await evaluateObsidian(page, (app) => {
      const store = app.plugins.plugins['routine-flow']?.store
      return store?.dispatch({ type: 'advance-phase' })
    })
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Weekly commitments and focus \(running\)$/)
    await expect(steps.nth(4)).toHaveClass(/is-active/)
    await expect(stageProgress.locator('.routine-stage-progress-indicator')).toHaveAttribute('style', /width:\s*80%/)
  })

  test('empty-state zero cue renders advance stage button and queueExhausted condition auto-advances phase', async ({ obsidianPage: { page } }) => {
    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')
    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .routine-queue')

    await expect(view).toHaveAttribute('data-view-graph-id', 'weekly-gtd')

    // Start weekly GTD review on inbox-clear
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Process inbox to zero: \d{2}:\d{2} \(running\)$/)

    // Dispatch queueExhausted while running -> auto-advances to project-review
    await evaluateObsidian(page, (app) => {
      return app.plugins.plugins['routine-flow']?.store.dispatch({
        type: 'set-queue-exhausted',
        exhausted: true,
      })
    })

    // Routine auto-advances to project-review and lands at status stopped per state machine
    await expect(panel.locator('h2')).toHaveText(/^Active project review: \d{2}:\d{2} \(stopped\)$/)

    // Clear active project notes so project-review enters zero-state
    const projectPaths = [
      'review-cadences/04-write-comprehensive-review-cadence-guide.md',
      'review-cadences/05-write-comprehensive-review-cadence-guide.md',
      'review-cadences/06-refactor-phase-transition-engine-store.md',
    ] as const

    await evaluateObsidian(page, async (app, args: { paths: readonly string[] }) => {
      for (const path of args.paths) {
        const file = app.vault.getFileByPath(path)
        if (file) {
          await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            // eslint-disable-next-line functional/immutable-data -- mutating frontmatter in e2e test
            fm.status = 'done'
          })
        }
      }
    }, { paths: projectPaths })

    const emptyQueue = queue.locator('.routine-queue-empty')
    await expect(emptyQueue).toBeVisible()
    await expect(emptyQueue).toHaveClass(/is-queue-exhausted/)
    await expect(emptyQueue).toHaveClass(/is-inbox-zero/)
    await expect(emptyQueue.locator('p')).toHaveText('Inbox zero reached — nothing to review.')

    // Advance stage button triggers phase progression to waiting-review
    const advanceBtn = emptyQueue.locator('.routine-queue-advance-btn')
    await expect(advanceBtn).toBeVisible()
    await expect(advanceBtn).toHaveText('Advance stage')
    await advanceBtn.click()

    await expect(panel.locator('h2')).toHaveText(/^Waiting-for follow-ups: \d{2}:\d{2} \(stopped\)$/)
  })

  test('prevents active session clobbering with modal confirmation when switching review routines', async ({ obsidianPage: { page } }) => {
    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')

    await expect(view).toHaveAttribute('data-view-graph-id', 'weekly-gtd')

    // Start Weekly GTD review so session is running
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Process inbox to zero: \d{2}:\d{2} \(running\)$/)

    // Switch to Daily kickoff sub-view
    await selectBasesSubView(page, 'Daily kickoff')
    await expect(view).toHaveAttribute('data-view-graph-id', 'daily-kickoff')

    // Click Start -> prompts confirmation modal
    await controls.getByRole('button', { name: 'Start' }).click()
    const modal = page.locator('.modal').filter({ hasText: 'Replace running routine?' })
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('Weekly GTD review')
    await expect(modal).toContainText('Daily kickoff routine')

    // Cancel preserves running Weekly GTD review
    await modal.getByRole('button', { name: 'Cancel' }).click()
    await expect(modal).toBeHidden()
    await expect(panel.locator('.routine-inert')).toHaveText(
      '"Weekly GTD review" is currently active instead of this view\'s routine ("Daily kickoff routine").',
    )

    // Click Start again and Replace switches to Daily kickoff
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: 'Replace' }).click()
    await expect(modal).toBeHidden()

    await expect(panel.locator('h2')).toHaveText(/^Hydration and morning movement: \d{2}:\d{2} \(running\)$/)
  })
})
