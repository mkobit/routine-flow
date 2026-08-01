import { defineConfig } from '@playwright/test'

// Dedicated config for capture-screenshots.manual.ts, a docs-screenshot
// regeneration tool, not a regression test -- its .manual.ts extension keeps
// it out of the main suite's testMatch ('**/*.e2e.ts'). Run it explicitly:
//   xvfb-run --auto-servernum --server-args="-screen 0 1280x1024x24" \
//     bunx playwright test --config=e2e/capture-screenshots.playwright.config.ts
export default defineConfig({
  testDir: '.',
  testMatch: 'capture-screenshots.manual.ts',
  globalSetup: './global-setup.ts',
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  use: {
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
})
