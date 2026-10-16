import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { selectBasesSubView } from './helpers/bases'
import { createNote, routineFileNote, writeNoteToVault } from './vault'

const PLUGIN_ID = 'routine-flow'
const ROUTINE_FOLDER = 'random-selector'
const ROUTINE_FILENAME = 'random-selector-routine.md'
const ROUTINE_PATH = `${ROUTINE_FOLDER}/${ROUTINE_FILENAME}`

const TASK_ALPHA_PATH = `${ROUTINE_FOLDER}/01-task-alpha.md`
const TASK_BETA_PATH = `${ROUTINE_FOLDER}/02-task-beta.md`
const TASK_GAMMA_PATH = `${ROUTINE_FOLDER}/03-task-gamma.md`

const SELECTOR_ROUTINE_GRAPH = {
  id: 'random-selector',
  name: 'Random task selector',
  phases: [
    {
      id: 'selector',
      name: 'Spin task wheel',
      label: 'Spin task wheel',
      kind: 'selector',
      duration: null,
      onCompletion: 'waitForManual',
      taskSourceId: 'selector-queue',
      queryFilter: {
        property: 'note.type',
        value: 'random-selector-task',
      },
      selector: {
        autoSpin: false,
        promoteToFront: true,
      },
      handlers: {},
    },
    {
      id: 'focus',
      name: 'Focus sprint',
      label: 'Focus sprint',
      kind: 'focus',
      duration: 'PT25M',
      onCompletion: 'autoAdvance',
      taskSourceId: 'selector-queue',
      queryFilter: {
        property: 'note.type',
        value: 'random-selector-task',
      },
      handlers: {},
    },
  ],
  transitions: [
    { from: 'selector', to: 'focus', guard: { kind: 'always' } },
    { from: 'focus', to: 'selector', guard: { kind: 'always' } },
  ],
}

function readFrontmatterValue(page: Page, filePath: string, property: string): Promise<unknown> {
  return evaluateObsidian(page, (app, args: { filePath: string, property: string }) => {
    const file = app.vault.getFileByPath(args.filePath)
    const value: unknown = file ? app.metadataCache.getFileCache(file)?.frontmatter?.[args.property] : undefined
    return value
  }, { filePath, property })
}

function readActiveFilePath(page: Page): Promise<string | null> {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID }) => {
    return app.plugins.plugins[args.pluginId]!.store.getState().activeFilePath
  }, { pluginId: PLUGIN_ID })
}

test.describe('Random task selector workflow', () => {
  test.beforeEach(async ({ obsidianPage: { page, vaultPath } }) => {
    const routineNote = routineFileNote(
      ROUTINE_FOLDER,
      ROUTINE_FILENAME,
      SELECTOR_ROUTINE_GRAPH,
      'Random task selector',
      'Spin the queue roulette wheel to pick and promote the next focus task.',
    )
    const taskNotes = [
      createNote(TASK_ALPHA_PATH, { 'type': 'random-selector-task', 'routine-priority': 10 }),
      createNote(TASK_BETA_PATH, { 'type': 'random-selector-task', 'routine-priority': 20 }),
      createNote(TASK_GAMMA_PATH, { 'type': 'random-selector-task', 'routine-priority': 30 }),
    ]

    for (const note of [routineNote, ...taskNotes]) {
      const writeError = await writeNoteToVault(vaultPath, note)
      expect(writeError).toBeUndefined()
    }

    await expect.poll(() => readFrontmatterValue(page, ROUTINE_PATH, 'is-routine')).toBe(true)
    await expect.poll(() => readFrontmatterValue(page, TASK_ALPHA_PATH, 'type')).toBe('random-selector-task')
    await expect.poll(() => readFrontmatterValue(page, TASK_BETA_PATH, 'type')).toBe('random-selector-task')
    await expect.poll(() => readFrontmatterValue(page, TASK_GAMMA_PATH, 'type')).toBe('random-selector-task')

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

    const configBtn = view.locator('.routine-config-toggle-btn')
    await configBtn.click()

    const routineSelect = view.locator('.routine-config-routine-file').getByRole('combobox')
    await expect(routineSelect).toBeVisible()
    await routineSelect.selectOption(ROUTINE_PATH)

    await expect(view).toHaveAttribute('data-view-graph-id', 'random-selector')
    await configBtn.click()

    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .routine-controls')
    await controls.getByRole('button', { name: 'Start' }).click()

    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .routine-timer-panel')
    await expect(panel.locator('h2')).toHaveText('Spin task wheel (running)')

    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .routine-queue')
    await expect(queue.locator('h3')).toHaveText('Selection queue')
    await expect(queue.locator('li .routine-task-name')).toHaveText([
      '01-task-alpha',
      '02-task-beta',
      '03-task-gamma',
    ])
  })

  test('spins queue with deceleration animation, disables spin button while spinning, highlights winner, and updates active file', async ({ obsidianPage: { page } }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .routine-queue')
    const spinBtn = queue.locator('.routine-queue-spin-btn')

    await expect(spinBtn).toBeVisible()
    await expect(spinBtn).toBeEnabled()

    await spinBtn.click()

    // Spin button is disabled while deceleration animation runs
    await expect(spinBtn).toBeDisabled()

    // Wait for deceleration animation to complete and re-enable the spin button
    await expect(spinBtn).toBeEnabled({ timeout: 15_000 })

    // Winner item receives .is-roulette-winner highlight
    const winnerItem = queue.locator('li.is-roulette-winner')
    await expect(winnerItem).toHaveCount(1)

    const winnerName = await winnerItem.locator('.routine-task-name').textContent()
    expect(winnerName).toMatch(/^0[123]-task-(alpha|beta|gamma)$/)

    // Live region announces the selected task
    await expect(queue.locator('.routine-queue-announcer')).toHaveText(`Selected task: ${winnerName ?? ''}`)

    // Store activeFilePath is updated to the selected winner's vault path
    await expect.poll(() => readActiveFilePath(page)).toBe(`${ROUTINE_FOLDER}/${winnerName ?? ''}.md`)

    // Winner is promoted to the front of the queue
    await expect(queue.locator('li .routine-task-name').first()).toHaveText(winnerName ?? '')
  })

  test('resolves winner instantaneously without animation steps when reduced motion is enabled', async ({ obsidianPage: { page } }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .routine-queue')
    const spinBtn = queue.locator('.routine-queue-spin-btn')

    await expect(spinBtn).toBeVisible()
    await expect(spinBtn).toBeEnabled()

    await spinBtn.click()

    // With prefers-reduced-motion: reduce, selection finishes synchronously without step delays
    const winnerItem = queue.locator('li.is-roulette-winner')
    await expect(winnerItem).toHaveCount(1, { timeout: 1000 })
    await expect(spinBtn).toBeEnabled()
    await expect(queue.locator('li.is-roulette-highlight')).toHaveCount(0)

    const winnerName = await winnerItem.locator('.routine-task-name').textContent()
    expect(winnerName).toMatch(/^0[123]-task-(alpha|beta|gamma)$/)

    await expect(queue.locator('.routine-queue-announcer')).toHaveText(`Selected task: ${winnerName ?? ''}`)
    await expect.poll(() => readActiveFilePath(page)).toBe(`${ROUTINE_FOLDER}/${winnerName ?? ''}.md`)
  })
})
