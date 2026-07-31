#!/usr/bin/env bun
import ObsidianLauncher from 'obsidian-launcher'
import * as path from 'node:path'
import { Command } from 'commander'
import { rebuildGeneratedVault, resolveVaultSeed } from '../e2e/vault'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')
const VAULT_PATH = path.join(ROOT_DIR, 'routine-flow-example-vault')
const CACHE_DIR = path.join(ROOT_DIR, '.obsidian-cache')

async function main(): Promise<void> {
  const program = new Command()
  program
    .description('Launch a provisioned Obsidian against the example vault. Opens on the real display -- for headless (Xvfb) launches, run `bun run vault:dev:headless` instead.')
    .option('--generated', 'rebuild the vault\'s per-routine notes (dev-docs/examples/) before launching', false)
    .option('--headless', 'wait for Obsidian to exit instead of detaching -- required under xvfb-run, which tears down the virtual display as soon as the wrapped command exits', false)
  program.parse()
  const { generated, headless } = program.opts<{ generated: boolean, headless: boolean }>()

  if (generated) {
    const seed = resolveVaultSeed()
    const errors = await rebuildGeneratedVault(VAULT_PATH, seed)
    if (errors.length > 0) {
      throw new AggregateError(errors, `Failed to write ${errors.length} generated vault note(s)`)
    }
    console.log(`Rebuilt generated vault notes in ${VAULT_PATH} (seed=${seed})`)
  }

  const launcher = new ObsidianLauncher({ cacheDir: CACHE_DIR })

  const { proc } = await launcher.launch({
    appVersion: 'latest',
    installerVersion: 'latest',
    vault: VAULT_PATH,
    copy: false,
    plugins: [ROOT_DIR],
    args: ['--disable-gpu'],
    // Headless (under xvfb-run) stays attached to the same process group so
    // this script can wait for and signal-relay to it below; real-display
    // mode detaches so the shell is handed back immediately.
    spawnOptions: { stdio: 'ignore', detached: !headless },
  })

  if (headless) {
    // xvfb-run tears down its virtual display as soon as the command it
    // wraps (this script) exits -- unref-and-return-immediately would kill
    // Obsidian's display out from under it while it's still running. Wait
    // for the real exit instead, and relay termination signals so an
    // interrupted launch can't leave Obsidian orphaned against a display
    // that's about to disappear (flow-9vx).
    process.on('SIGINT', () => proc.kill('SIGINT'))
    process.on('SIGTERM', () => proc.kill('SIGTERM'))
    console.log(`Obsidian launched under Xvfb (pid ${proc.pid}) — vault: ${VAULT_PATH}. Waiting for exit...`)
    await new Promise<void>(resolve => proc.on('exit', () => resolve()))
    return
  }

  proc.unref()
  console.log(`Obsidian launched in the background (pid ${proc.pid}) — vault: ${VAULT_PATH}`)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
