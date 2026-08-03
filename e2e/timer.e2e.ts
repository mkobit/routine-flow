import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { generateVault, resolveVaultSeed } from './vault'
import type { NoteDefinition } from './vault'

const PLUGIN_ID = 'routine-flow'

/** Mirrors createBaseQuerySource's priority read (src/timer/base-query-task-source.ts) -- missing/non-numeric priority sorts as 0. */
function routinePriorityOf(note: NoteDefinition): number {
  const value = note.frontmatter['routine-priority']
  return typeof value === 'number' ? value : 0
}

test.describe('Routine Timer View', () => {
  test('registers bases view and can start a timer', async ({ obsidianPage: { page } }) => {
    // Assert registration exists
    await expect.poll(async () =>
      evaluateObsidian(
        page,
        (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
        { pluginId: PLUGIN_ID },
      ),
    ).toBe(true)
  })
})

test.describe('duration-less phase (finish-phase / "Done" control)', () => {
  test.beforeEach(async ({ obsidianPage: { page } }) => {
    await expect.poll(async () =>
      evaluateObsidian(
        page,
        (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
        { pluginId: PLUGIN_ID },
      ),
    ).toBe(true)

    // Tasks.base's "Workout" view (routines/workout-routine.md) has a duration-less "Set" phase.
    // Reuse the bases leaf the vault's persisted workspace.json already restores on launch (rather
    // than opening a second tab) so exactly one bases leaf exists to select below.
    await evaluateObsidian(page, async (app) => {
      const file = app.vault.getFileByPath('Tasks.base')
      if (!file) {
        throw new Error('Tasks.base not found')
      }
      const leaf = app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')
      await leaf.openFile(file)
    })
    await page.locator('.workspace-leaf-content[data-type="bases"] .bases-toolbar-views-menu .text-icon-button').click()
    await page.locator('.menu .bases-toolbar-menu-item-name', { hasText: 'Workout' }).click()
  })

  test('renders the phase (not blank) and a Done button appears once running, completing the phase on click', async ({ obsidianPage: { page } }) => {
    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')

    // beforeEach's sub-view switch resolves before this view's async routine-file load settles --
    // wait for the resolved-graph marker so Start isn't clicked against the previous sub-view's
    // still-attached button mid-load (flow-6v7).
    await expect(view).toHaveAttribute('data-view-graph-id', 'workout')

    // The header currently reflects the shared engine's default (untouched) graph, not this tab's
    // own Workout routine -- that only takes effect once Start switches the engine's active graph.
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Warm-up: \d{2}:\d{2} \(running\)$/)

    // advance-phase always lands at 'stopped' -- skip the warmup timer (avoid a real wall-clock
    // wait) and start the duration-less "Set" phase it reveals.
    await evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID }) =>
      app.plugins.plugins[args.pluginId]!.store.dispatch({ type: 'advance-phase' }), { pluginId: PLUGIN_ID })
    await expect(panel.locator('h2')).toHaveText('Set (stopped)')

    await controls.getByRole('button', { name: 'Start' }).click()

    // Duration-less: no countdown in the header, and a Done control instead of a blank view.
    await expect(panel.locator('h2')).toHaveText('Set (running)')
    const doneBtn = controls.getByRole('button', { name: 'Done' })
    await expect(doneBtn).toBeVisible()

    await doneBtn.click()

    // "Set"'s completionPolicy is null, so finish-phase auto-advances to "Rest".
    await expect(panel.locator('h2')).toHaveText(/^Rest: \d{2}:\d{2} \(stopped\)$/)
  })
})

test.describe('manualClear phase (advance-phase / "Clear" control)', () => {
  test.beforeEach(async ({ obsidianPage: { page } }) => {
    await expect.poll(async () =>
      evaluateObsidian(
        page,
        (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
        { pluginId: PLUGIN_ID },
      ),
    ).toBe(true)

    await evaluateObsidian(page, async (app) => {
      const file = app.vault.getFileByPath('Tasks.base')
      if (!file) {
        throw new Error('Tasks.base not found')
      }
      const leaf = app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')
      await leaf.openFile(file)
    })
    await page.locator('.workspace-leaf-content[data-type="bases"] .bases-toolbar-views-menu .text-icon-button').click()
    await page.locator('.menu .bases-toolbar-menu-item-name', { hasText: 'Manual clear' }).click()
  })

  test('a Clear button appears once the phase completes, and clicking it advances to the next phase', async ({ obsidianPage: { page } }) => {
    const view = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-view')
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')

    await expect(view).toHaveAttribute('data-view-graph-id', 'manual-clear')

    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Focus: \d{2}:\d{2} \(running\)$/)

    // Force completion directly rather than waiting out the 5s real-world duration -- finish-phase
    // doesn't tick `remaining` down first, so it stays at whatever it was ("00:05") here.
    await evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID }) =>
      app.plugins.plugins[args.pluginId]!.store.dispatch({ type: 'finish-phase' }), { pluginId: PLUGIN_ID })
    await expect(panel.locator('h2')).toHaveText(/^Focus: \d{2}:\d{2} \(completed\)$/)

    const clearBtn = controls.getByRole('button', { name: 'Clear' })
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()

    await expect(panel.locator('h2')).toHaveText(/^Break: \d{2}:\d{2} \(stopped\)$/)
  })
})

test.describe('BaseQuerySource-backed queue (base-query-task-source)', () => {
  test.beforeEach(async ({ obsidianPage: { page } }) => {
    await expect.poll(async () =>
      evaluateObsidian(
        page,
        (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
        { pluginId: PLUGIN_ID },
      ),
    ).toBe(true)

    // .obsidian/workspace.json is gitignored (runtime state, not canonical vault content) -- a
    // fresh checkout (CI, or any new clone) has no persisted leaf, so Tasks.base must be opened and
    // its "Default" sub-view selected explicitly, same as the "Workout" sub-view below.
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
  })

  test('Work queue renders real Bases entries sorted by routine-priority', async ({ obsidianPage: { page } }) => {
    // Tasks.base's "Default" sub-view (no routineFile -- the default DEFAULT_PHASE_GRAPH) has a
    // focus phase whose taskSourceId is focus-queue. No engine interaction needed: the queue
    // renders from the shared engine's default (untouched) state, which starts at the 'focus' phase.
    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .routine-queue')
    await expect(queue.locator('h3')).toHaveText('Work queue')

    // Derived from the same generateVault(resolveVaultSeed()) the vault was built from, rather than
    // duplicating its output as literals here (a VAULT_SEED override would otherwise change the
    // vault's contents without this assertion following along). Sort mirrors
    // createBaseQuerySource (src/timer/base-query-task-source.ts): ascending by routine-priority,
    // missing priority sorts as 0. displayName is the file's basename (indexedPath's slugified
    // filename), not the note's title.
    const expectedDisplayNames = generateVault(resolveVaultSeed())
      .filter(note => note.relativePath.dir === 'pomodoro')
      .toSorted((a, b) => routinePriorityOf(a) - routinePriorityOf(b))
      .map(note => note.relativePath.name)

    await expect(queue.locator('li button')).toHaveText(expectedDisplayNames, { timeout: 20_000 })
  })
})
