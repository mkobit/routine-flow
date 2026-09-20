import {
  test,
  expect,
  enableMobileEmulation,
  setMobileViewport,
  openMobileSettings,
  closeMobileSettings,
  MOBILE_VIEWPORTS,
} from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'

test.describe('mobile obsidian fixture and emulation', () => {
  test('mobileObsidianPage fixture boots in phone emulation mode', async ({ mobileObsidianPage: { page } }) => {
    const isMobile = await evaluateObsidian(page, app => app.isMobile)
    expect(isMobile).toBe(true)

    const bodyClasses = await page.evaluate(() => Array.from(document.body.classList))
    expect(bodyClasses).toContain('is-mobile')
    expect(bodyClasses).toContain('emulate-mobile')
    expect(bodyClasses).toContain('is-phone')
    expect(bodyClasses).not.toContain('is-tablet')

    const viewport = page.viewportSize()
    expect(viewport).toEqual(MOBILE_VIEWPORTS.phone)
  })

  test('setMobileViewport switches to tablet emulation dynamically', async ({ mobileObsidianPage: { page } }) => {
    await setMobileViewport(page, 'tablet')

    const viewport = page.viewportSize()
    expect(viewport).toEqual(MOBILE_VIEWPORTS.tablet)

    await expect.poll(async () => {
      const classes = await page.evaluate(() => Array.from(document.body.classList))
      return classes.includes('is-tablet') && !classes.includes('is-phone')
    }).toBe(true)
  })

  test('openMobileSettings opens in-page settings modal and closeMobileSettings closes it', async ({ mobileObsidianPage: { page } }) => {
    const modal = await openMobileSettings(page, 'routine-flow')
    await expect(modal).toBeVisible()

    // Assert that settings is rendered in-page, not as a separate desktop BrowserWindow
    expect(page.context().pages()).toHaveLength(1)

    // Plugin settings content should be visible in the settings tab
    await expect(modal.locator('.routine-setting-tab')).toBeVisible()
    await expect(modal.locator('.setting-item', { hasText: 'Write-back property' })).toBeVisible()

    await closeMobileSettings(page)
    await expect(modal).toBeHidden()
  })

  test('enableMobileEmulation converts desktop obsidianPage to mobile emulation', async ({ obsidianPage: { page } }) => {
    const initialIsMobile = await evaluateObsidian(page, app => app.isMobile)
    expect(initialIsMobile).toBeFalsy()

    await enableMobileEmulation(page, { device: 'tablet' })

    const isMobile = await evaluateObsidian(page, app => app.isMobile)
    expect(isMobile).toBe(true)

    const bodyClasses = await page.evaluate(() => Array.from(document.body.classList))
    expect(bodyClasses).toContain('is-mobile')
    expect(bodyClasses).toContain('is-tablet')
    expect(bodyClasses).not.toContain('is-phone')

    const viewport = page.viewportSize()
    expect(viewport).toEqual(MOBILE_VIEWPORTS.tablet)
  })
})
