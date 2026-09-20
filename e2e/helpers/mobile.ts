import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { evaluateObsidian } from './evaluate'

export type MobileDevice = 'phone' | 'tablet'

export type EnableMobileEmulationOptions = {
  readonly device?: MobileDevice
}

export const MOBILE_VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
} as const satisfies Record<MobileDevice, { readonly width: number, readonly height: number }>

export async function setMobileViewport(page: Page, device: MobileDevice): Promise<void> {
  await page.setViewportSize(MOBILE_VIEWPORTS[device])
}

export async function enableMobileEmulation(
  page: Page,
  options?: EnableMobileEmulationOptions,
): Promise<void> {
  const device = options?.device ?? 'phone'
  const viewport = MOBILE_VIEWPORTS[device]

  await page.evaluate(() => {
    window.localStorage.setItem('EmulateMobile', '1')
  })
  await page.setViewportSize(viewport)
  await page.reload()

  await page.waitForFunction(
    () => typeof window.app !== 'undefined'
      && Boolean(window.app.isMobile)
      && Boolean(window.app.workspace?.layoutReady)
      && window.app.plugins?.plugins?.['routine-flow'] !== undefined,
    { timeout: 30_000 },
  )
}

export function getMobileSettingsModal(page: Page): Locator {
  return page.locator('.modal-container.mod-dim .modal.mod-settings')
}

export async function expectInPageSettingsModal(page: Page): Promise<Locator> {
  const modal = getMobileSettingsModal(page)
  await expect(modal).toBeVisible()
  expect(page.context().pages()).toHaveLength(1)
  return modal
}

export async function openMobileSettings(page: Page, tabId?: string): Promise<Locator> {
  await evaluateObsidian(page, (app, args: { tabId?: string }) => {
    app.setting.open()
    if (args.tabId) {
      app.setting.openTabById(args.tabId)
    }
  }, { tabId })

  return expectInPageSettingsModal(page)
}

export async function closeMobileSettings(page: Page): Promise<void> {
  const modal = getMobileSettingsModal(page)
  const closeButton = modal.locator('.modal-close-button')
  if (await closeButton.isVisible()) {
    await closeButton.click()
  }
  else {
    await page.keyboard.press('Escape')
  }
  await expect(modal).toBeHidden()
}
