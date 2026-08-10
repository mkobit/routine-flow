import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'

const PLUGIN_ID = 'routine-flow'

test.describe('plugin lifecycle', () => {
  test('loads into the plugin registry', async ({ obsidianPage: { page } }) => {
    const isLoaded = await evaluateObsidian(
      page,
      (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
      { pluginId: PLUGIN_ID },
    )
    expect(isLoaded).toBe(true)
  })
})
