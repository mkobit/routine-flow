import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/obsidian'
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

// Skipped: app.setting.open() reliably FATALs Obsidian's GPU process under Xvfb, both locally
// and in CI (flow-1la) -- confirmed deterministic (10/10 launches across all 5 tests here failed
// identically, sandwiched between clean passes on either side in the same CI run), not ordinary
// flakiness. Re-enable once flow-1la resolves or isolates the trigger to something other than
// opening the settings modal itself.
test.describe.skip('settings tab', () => {
  test.beforeEach(async ({ obsidianPage: { page } }) => {
    await expect.poll(async () =>
      evaluateObsidian(
        page,
        (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
        { pluginId: PLUGIN_ID },
      ),
    ).toBe(true)

    await evaluateObsidian(page, (app, args: { pluginId: string }) => {
      app.setting.open()
      app.setting.openTabById(args.pluginId)
    }, { pluginId: PLUGIN_ID })
  })

  test('editing the write-back property field persists the new value', async ({ obsidianPage: { page } }) => {
    const field = page.locator('.setting-item', { hasText: 'Write-back property' }).locator('input[type="text"]')
    await field.fill('e2e-sessions')
    await field.blur()

    await expect.poll(() => getWriteBackProperty(page)).toBe('e2e-sessions')
  })

  test('adding a valid rule shows it in the list', async ({ obsidianPage: { page } }) => {
    const addRow = page.locator('.setting-item', { hasText: 'Add rule' })
    await addRow.getByPlaceholder('Name').fill('e2e-valid-rule')
    await addRow.getByPlaceholder('Condition').fill('true')
    await addRow.getByRole('button', { name: 'Add' }).click()

    await expect(page.locator('.setting-item', { hasText: 'e2e-valid-rule' })).toBeVisible()
    await expect.poll(() => hasFormulaPredicateNamed(page, 'e2e-valid-rule')).toBe(true)
  })

  test('an empty rule name shows an inline error and does not add a row', async ({ obsidianPage: { page } }) => {
    const addRow = page.locator('.setting-item', { hasText: 'Add rule' })
    await addRow.getByPlaceholder('Condition').fill('true')
    await addRow.getByRole('button', { name: 'Add' }).click()

    await expect(page.getByText('Enter a rule name.')).toBeVisible()
  })

  test('a non-compiling formula shows an inline error and does not add a row', async ({ obsidianPage: { page } }) => {
    const addRow = page.locator('.setting-item', { hasText: 'Add rule' })
    await addRow.getByPlaceholder('Name').fill('e2e-bad-rule')
    await addRow.getByPlaceholder('Condition').fill('this is not a valid formula ((')
    await addRow.getByRole('button', { name: 'Add' }).click()

    await expect(page.locator('.setting-item', { hasText: 'e2e-bad-rule' })).toHaveCount(0)
    await expect.poll(() => hasFormulaPredicateNamed(page, 'e2e-bad-rule')).toBe(false)
  })

  test('deleting a rule removes its row', async ({ obsidianPage: { page } }) => {
    const addRow = page.locator('.setting-item', { hasText: 'Add rule' })
    await addRow.getByPlaceholder('Name').fill('e2e-delete-me')
    await addRow.getByPlaceholder('Condition').fill('true')
    await addRow.getByRole('button', { name: 'Add' }).click()

    const row = page.locator('.setting-item', { hasText: 'e2e-delete-me' })
    await expect(row).toBeVisible()

    // SettingDefinitionList's onDelete renders a delete affordance per item and also enables the
    // Delete/Backspace keyboard shortcut (obsidian.d.ts) -- click the row to focus it, then use the
    // keyboard path rather than guessing the icon button's class/aria-label.
    await row.click()
    await page.keyboard.press('Delete')

    await expect(row).toHaveCount(0)
    await expect.poll(() => hasFormulaPredicateNamed(page, 'e2e-delete-me')).toBe(false)
  })
})
