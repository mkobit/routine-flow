#!/usr/bin/env bun
// Refresh the plugin in the running `vault:dev` Obsidian without restarting.
// Copies the freshly-built main.js/manifest.json/styles.css into the live
// vault's plugin directory, then reloads it via Obsidian's official CLI
// (https://obsidian.md/help/cli) so Obsidian picks up the new bundle.
//
// Iteration loop: `bun run dev` (esbuild watch) -> edit -> `bun run vault:reload`
//
// Adapted from bases-chartkit's scripts/vault-reload.ts: that version copies
// artifacts into its tracked example-vault path directly, but vault-dev.ts
// (in both repos) actually launches against a fresh tmpdir copy each run --
// writing to the tracked path would silently miss the vault Obsidian is
// really running against. This asks the live instance for its actual base
// path via `eval` instead of assuming a fixed location.
//
// obsidian-cli targets a single globally-active Obsidian instance -- with
// more than one `vault:dev` (from any repo sharing this harness) running at
// once, which instance responds is undefined. Same single-instance
// assumption the sibling repo's scripts make implicitly.

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { runObsidianCli } from './obsidian-cli'

const PLUGIN_ID = 'routine-flow'
const PLUGIN_ARTIFACTS = ['main.js', 'manifest.json', 'styles.css'] as const
const ROOT_DIR = path.resolve(import.meta.dirname, '..')

async function resolveRunningVaultPath(): Promise<string> {
  const { stdout, stderr, exitCode } = await runObsidianCli(['eval', 'code=app.vault.adapter.getBasePath()'])
  if (exitCode !== 0 || !stdout) {
    throw new Error(stderr || 'Could not resolve the running vault\'s path — is `bun run vault:dev` running?')
  }
  // obsidian-cli prints eval results as `=> <value>`.
  return stdout.replace(/^=>\s*/, '')
}

async function main(): Promise<void> {
  const vaultPath = await resolveRunningVaultPath()
  const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', PLUGIN_ID)
  await fs.mkdir(pluginDir, { recursive: true })
  await Promise.all(PLUGIN_ARTIFACTS.map(async (f) => {
    const src = path.join(ROOT_DIR, f)
    try {
      await fs.access(src)
    }
    catch {
      console.error(`Missing ${f} at repo root — run \`bun run build\` or \`bun run dev\` first`)
      process.exit(1)
    }
    await fs.cp(src, path.join(pluginDir, f))
  }))

  const { stdout, stderr, exitCode } = await runObsidianCli(['plugin:reload', `id=${PLUGIN_ID}`])
  if (exitCode !== 0) {
    console.error(stderr || 'obsidian-cli plugin:reload failed — is `bun run vault:dev` running?')
    process.exit(exitCode)
  }
  console.log(stdout || `Reloaded ${PLUGIN_ID}`)
}

main().catch((err: unknown) => {
  console.error('Fatal error in vault-reload:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
