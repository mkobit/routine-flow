#!/usr/bin/env bun
// Refresh the plugin in the running `vault:dev` Obsidian without restarting.
// Copies the freshly-built main.js/manifest.json/styles.css into the live
// vault's plugin directory, then reloads it via Obsidian's official CLI
// (https://obsidian.md/help/cli) so Obsidian picks up the new bundle.
//
// Iteration loop: `bun run dev` (esbuild watch) -> edit -> `bun run vault:reload`
//
// Adapted from bases-chartkit's scripts/vault-reload.ts: that version copies
// artifacts into its tracked example-vault path directly, but dev.ts
// (in both repos) actually launches against a fresh tmpdir copy each run --
// writing to the tracked path would silently miss the vault Obsidian is
// really running against. This asks the live instance for its actual base
// path via `eval` instead of assuming a fixed location.
//
// obsidian-cli targets a single globally-active Obsidian instance -- with
// more than one `vault:dev` (from any repo sharing this harness) running at
// once, which instance responds is undefined. Same single-instance
// assumption the sibling repo's scripts make implicitly.

import * as path from 'node:path'
import { Command } from 'commander'
import {
  PLUGIN_ID,
  assertBuiltArtifacts,
  copyPluginArtifacts,
  resolveRunningVaultPath,
  runCli,
  runObsidianCli,
} from './shared'

async function runReload(): Promise<void> {
  const vaultPath = await resolveRunningVaultPath()
  await assertBuiltArtifacts('run `bun run build` or `bun run dev` first')

  const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', PLUGIN_ID)
  await copyPluginArtifacts(pluginDir)

  const { stdout, stderr, exitCode } = await runObsidianCli(['plugin:reload', `id=${PLUGIN_ID}`])
  if (exitCode !== 0) {
    console.error(stderr || 'obsidian-cli plugin:reload failed — is `bun run vault:dev` running?')
    process.exit(exitCode)
  }
  console.log(stdout || `Reloaded ${PLUGIN_ID}`)
}

const program = new Command()
  .name('vault-reload')
  .description('Copy built plugin artifacts into the running `vault:dev` vault and reload the plugin.')
  .action(runReload)

runCli('vault-reload', () => program.parseAsync())
