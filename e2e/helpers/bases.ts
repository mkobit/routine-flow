import { expect, type Page } from '@playwright/test'

/**
 * Selects a sub-view in a Bases leaf (e.g. "Default", "Workout") via the Bases toolbar views menu.
 * Retries clicking the menu button if the dropdown menu popover is slow to open during leaf initialization.
 */
export async function selectBasesSubView(page: Page, subViewName: string): Promise<void> {
  const viewsMenuButton = page.locator('.workspace-leaf-content[data-type="bases"] .bases-toolbar-views-menu .text-icon-button')
  const menuItem = page.locator('.menu .bases-toolbar-menu-item-name', { hasText: subViewName })

  await expect.poll(async () => {
    if (!await menuItem.isVisible()) {
      await viewsMenuButton.click()
    }
    return await menuItem.isVisible()
  }, { timeout: 15_000, intervals: [500, 1000] }).toBe(true)

  await menuItem.click()
}
