import { describe, expect, it } from 'bun:test'
import { MOBILE_VIEWPORTS } from '../e2e/helpers/mobile'

describe('mobile viewports', () => {
  it('defines phone viewport within Obsidian mobile phone threshold (<= 550px)', () => {
    expect(MOBILE_VIEWPORTS.phone.width).toBeLessThanOrEqual(550)
    expect(MOBILE_VIEWPORTS.phone.width).toBe(390)
    expect(MOBILE_VIEWPORTS.phone.height).toBe(844)
  })

  it('defines tablet viewport above Obsidian mobile phone threshold (> 550px)', () => {
    expect(MOBILE_VIEWPORTS.tablet.width).toBeGreaterThan(550)
    expect(MOBILE_VIEWPORTS.tablet.width).toBe(768)
    expect(MOBILE_VIEWPORTS.tablet.height).toBe(1024)
  })
})
