import type { Page } from '@playwright/test'
import { test as obsidianTest, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'

const PLUGIN_ID = 'routine-flow'

function getWriteBackProperty(page: Page): Promise<string | undefined> {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID }) =>
    app.plugins.plugins[args.pluginId]?.settings.writeBackProperty, { pluginId: PLUGIN_ID })
}

function hasFormulaPredicateNamed(page: Page, name: string): Promise<boolean> {
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID, name: string }) =>
    app.plugins.plugins[args.pluginId]?.settings.formulaPredicates.some(p => p.name === args.name) ?? false, { pluginId: PLUGIN_ID, name })
}

type SettingsFixtures = {
  /**
   * Obsidian's Settings UI renders in a genuinely separate Electron BrowserWindow, not an
   * in-page `.modal` over `obsidianPage.page` -- confirmed via `context.pages()` growing from
   * 1 to 2 the instant `app.setting.open()` runs (flow-ac5). Previously misdiagnosed as a
   * render-latency cost of the flow-1la GPU-crash-fix flags: the original `.setting-item`
   * locator was scoped to `obsidianPage.page`, which never receives the settings DOM, so it
   * waited out the full test timeout regardless of length (confirmed hanging past even a 300s
   * timeout, i.e. not "slow", just looking in the wrong window). `evaluateObsidian` calls must
   * still target the original `obsidianPage.page` -- the settings window has no `window.app`
   * of its own -- but all UI locators need this second page.
   */
  settingsPage: Page
}

const test = obsidianTest.extend<SettingsFixtures>({
  settingsPage: async ({ obsidianPage: { page } }, use) => {
    await expect.poll(async () =>
      evaluateObsidian(
        page,
        (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
        { pluginId: PLUGIN_ID },
      ),
    ).toBe(true)

    const settingsPagePromise = page.context().waitForEvent('page')
    await evaluateObsidian(page, (app, args: { pluginId: string }) => {
      app.setting.open()
      app.setting.openTabById(args.pluginId)
    }, { pluginId: PLUGIN_ID })

    const settingsPage = await settingsPagePromise
    await settingsPage.waitForLoadState('domcontentloaded')
    await use(settingsPage)
  },
})

test.describe('settings tab', () => {
  test('editing the write-back property field persists the new value', async ({ obsidianPage: { page }, settingsPage }) => {
    const field = settingsPage.locator('.setting-item', { hasText: 'Write-back property' }).locator('input[type="text"]')
    await field.fill('e2e-sessions')
    await field.blur()

    await expect.poll(() => getWriteBackProperty(page)).toBe('e2e-sessions')
  })

  test('adding a valid rule shows it in the list', async ({ obsidianPage: { page }, settingsPage }) => {
    const addRow = settingsPage.locator('.setting-item', { hasText: 'Add rule' })
    await addRow.getByPlaceholder('Name').fill('e2e-valid-rule')
    await addRow.getByPlaceholder('Condition').fill('true')
    await addRow.getByRole('button', { name: 'Add' }).click()

    await expect(settingsPage.locator('.setting-item', { hasText: 'e2e-valid-rule' })).toBeVisible()
    await expect.poll(() => hasFormulaPredicateNamed(page, 'e2e-valid-rule')).toBe(true)
  })

  test('an empty rule name shows an inline error and does not add a row', async ({ settingsPage }) => {
    const addRow = settingsPage.locator('.setting-item', { hasText: 'Add rule' })
    await addRow.getByPlaceholder('Condition').fill('true')
    await addRow.getByRole('button', { name: 'Add' }).click()

    await expect(settingsPage.getByText('Enter a rule name.')).toBeVisible()
  })

  test('a non-compiling formula shows an inline error and does not add a row', async ({ obsidianPage: { page }, settingsPage }) => {
    const addRow = settingsPage.locator('.setting-item', { hasText: 'Add rule' })
    await addRow.getByPlaceholder('Name').fill('e2e-bad-rule')
    await addRow.getByPlaceholder('Condition').fill('this is not a valid formula ((')
    await addRow.getByRole('button', { name: 'Add' }).click()

    await expect(settingsPage.locator('.setting-item', { hasText: 'e2e-bad-rule' })).toHaveCount(0)
    await expect.poll(() => hasFormulaPredicateNamed(page, 'e2e-bad-rule')).toBe(false)
  })

  test('deleting a rule removes its row', async ({ obsidianPage: { page }, settingsPage }) => {
    const addRow = settingsPage.locator('.setting-item', { hasText: 'Add rule' })
    await addRow.getByPlaceholder('Name').fill('e2e-delete-me')
    await addRow.getByPlaceholder('Condition').fill('true')
    await addRow.getByRole('button', { name: 'Add' }).click()

    const row = settingsPage.locator('.setting-item', { hasText: 'e2e-delete-me' })
    await expect(row).toBeVisible()

    // SettingDefinitionList's onDelete renders a delete affordance per item and also enables the
    // Delete/Backspace keyboard shortcut (obsidian.d.ts) -- click the row to focus it, then use the
    // keyboard path rather than guessing the icon button's class/aria-label.
    await row.click()
    await settingsPage.keyboard.press('Delete')

    await expect(row).toHaveCount(0)
    await expect.poll(() => hasFormulaPredicateNamed(page, 'e2e-delete-me')).toBe(false)
  })
})
