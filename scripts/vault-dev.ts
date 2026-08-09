#!/usr/bin/env bun
// Usage: bun run vault:dev [-- --theme <light|dark>]  (defaults to dark)
// --theme presets Obsidian's base color scheme before launch (ported from
// bases-chartkit's scripts/vault-dev.ts, same obsidian-launcher harness).
// Requires copying the vault first -- see the setupVault call below.
import ObsidianLauncher from 'obsidian-launcher'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { Command, Option } from 'commander'
import { rebuildGeneratedVault, resolveVaultSeed, stripGitignoredVaultState } from '../e2e/vault'
import { applyViewMode } from './appearance'
import type { ViewMode } from './appearance'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')
const VAULT_PATH = path.join(ROOT_DIR, 'routine-flow-example-vault')
const CACHE_DIR = path.join(ROOT_DIR, '.obsidian-cache')
// Only used for the CDP window-resize workaround below -- this repo has no
// Obsidian-CLI-based dev scripts (unlike bases-chartkit's vault-eval.ts/
// vault-screenshot.ts), so nothing else talks to this port.
const CDP_PORT = 9222
// Electron ignores the `--window-size` Chromium switch and always opens at
// its own ~1024x800 default for a fresh profile -- resizing via the
// renderer's `window.resizeTo` (which Electron forwards to the
// BrowserWindow) is what actually works. Matches bases-chartkit's
// vault-dev.ts.
const WINDOW_WIDTH = 2560
const WINDOW_HEIGHT = 1440

interface CdpPage {
  readonly type: string
  readonly webSocketDebuggerUrl: string
}

// Narrows the CDP /json/list response without a type assertion
// (consistent-type-assertions: never) -- matches scripts/appearance.ts's isRecord.
function isCdpPage(value: unknown): value is CdpPage {
  return typeof value === 'object' && value !== null
    && 'type' in value && typeof value.type === 'string'
    && 'webSocketDebuggerUrl' in value && typeof value.webSocketDebuggerUrl === 'string'
}

async function findObsidianPage(): Promise<CdpPage | undefined> {
  try {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
    const pages: unknown = await res.json()
    return Array.isArray(pages) ? pages.find(isCdpPage) : undefined
  }
  catch {
    return undefined
  }
}

function resizeOverWebsocket(wsUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    ws.addEventListener('error', () => reject(new Error('ws error connecting to CDP')))
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: `window.resizeTo(${WINDOW_WIDTH}, ${WINDOW_HEIGHT})` },
      }))
    })
    ws.addEventListener('message', () => {
      ws.close()
      resolve()
    })
  })
}

async function resizeWindowWhenReady(attemptsRemaining = 20): Promise<void> {
  const page = await findObsidianPage()
  if (page) {
    await resizeOverWebsocket(page.webSocketDebuggerUrl)
    return
  }
  if (attemptsRemaining <= 0) {
    console.error('Timed out waiting for Obsidian CDP page to resize the window.')
    return
  }
  await Bun.sleep(500)
  await resizeWindowWhenReady(attemptsRemaining - 1)
}

async function main(): Promise<void> {
  const program = new Command()
  program
    .description('Launch a provisioned Obsidian against the example vault. Opens on the real display -- for headless (Xvfb) launches, run `bun run vault:dev:headless` instead.')
    .option('--generated', 'rebuild the vault\'s per-routine notes (dev-docs/examples/) before launching', false)
    .option('--headless', 'wait for Obsidian to exit instead of detaching -- required under xvfb-run, which tears down the virtual display as soon as the wrapped command exits', false)
    .addOption(new Option('--theme <mode>', 'preset Obsidian\'s color scheme before launch').choices(['light', 'dark']).default('dark'))
  program.parse()
  const { generated, headless, theme } = program.opts<{ generated: boolean, headless: boolean, theme: ViewMode }>()

  if (generated) {
    const seed = resolveVaultSeed()
    const errors = await rebuildGeneratedVault(VAULT_PATH, seed)
    if (errors.length > 0) {
      throw new AggregateError(errors, `Failed to write ${errors.length} generated vault note(s)`)
    }
    console.log(`Rebuilt generated vault notes in ${VAULT_PATH} (seed=${seed})`)
  }

  const launcher = new ObsidianLauncher({ cacheDir: CACHE_DIR })

  // Copied to a tmpdir so interactive poking never dirties the git-tracked
  // example vault (Obsidian rewrites .base YAML and workspace state on every
  // view interaction), matching e2e/fixtures/obsidian.ts's own vault-copy
  // step. Stripped of gitignored runtime state for the same reason that
  // fixture strips it -- otherwise a local leftover interactive-session
  // state would leak into a supposedly-fresh launch. Done as its own
  // setupVault() call (rather than via launch()'s copy:true) so there's a
  // copied-but-not-yet-launched vault to write the --theme preset into
  // before Obsidian ever reads it.
  const copiedVault = await launcher.setupVault({ vault: VAULT_PATH, copy: true })
  await stripGitignoredVaultState(copiedVault)
  await applyViewMode(copiedVault, theme)

  const { proc, configDir, vault } = await launcher.launch({
    appVersion: 'latest',
    installerVersion: 'latest',
    vault: copiedVault,
    // Already copied and theme-preset above -- copy:false here avoids a
    // redundant second copy of the vault.
    copy: false,
    plugins: [ROOT_DIR],
    // See e2e/fixtures/obsidian.ts's identical GPU-workaround args for the
    // full rationale (flow-1la, bases-chartkit's bck-to4/bck-cyz) -- bare
    // --disable-gpu alone is insufficient and can crash faster than no flag
    // at all; these four are the validated workaround for Chromium's
    // GPU-process crash-retry ceiling under WSL2/Xvfb. The CDP flags enable
    // the window-resize trick above.
    args: [
      '--disable-gpu',
      '--disable-gpu-compositing',
      '--disable-software-rasterizer',
      '--disable-gpu-sandbox',
      `--remote-debugging-port=${CDP_PORT}`,
      '--remote-allow-origins=*',
    ],
    // Headless (under xvfb-run) stays attached to the same process group so
    // this script can wait for and signal-relay to it below; real-display
    // mode detaches so the shell is handed back immediately.
    spawnOptions: { stdio: 'ignore', detached: !headless },
  })

  void resizeWindowWhenReady()

  if (headless) {
    // xvfb-run tears down its virtual display as soon as the command it
    // wraps (this script) exits -- unref-and-return-immediately would kill
    // Obsidian's display out from under it while it's still running. Wait
    // for the real exit instead, and relay termination signals so an
    // interrupted launch can't leave Obsidian orphaned against a display
    // that's about to disappear (flow-9vx).
    process.on('SIGINT', () => proc.kill('SIGINT'))
    process.on('SIGTERM', () => proc.kill('SIGTERM'))
    console.log(`Obsidian launched under Xvfb (pid ${proc.pid}) — vault: ${vault ?? copiedVault}. Waiting for exit...`)
    await new Promise<void>(resolve => proc.on('exit', () => resolve()))
    // obsidian-launcher doesn't clean up the per-launch configDir/vault-copy
    // tmpdirs it creates -- this path already blocks for the whole run, so it
    // can safely remove them once Obsidian has exited (mirrors
    // e2e/fixtures/obsidian.ts's cleanupObsidianTmpdirs, fixed there under
    // flow-i43).
    await Promise.allSettled([
      fs.rm(configDir, { recursive: true, force: true }),
      fs.rm(vault ?? copiedVault, { recursive: true, force: true }),
    ])
    return
  }

  // Real-display mode detaches and hands the shell back immediately (by design,
  // see AGENTS.md), so this invocation exits before Obsidian does and has no
  // way to observe when it's safe to remove configDir/the vault copy -- those
  // tmpdirs are accepted as a leak here (bun run vault:dev:headless does not
  // have this issue) rather than adding a detached watcher process to close
  // them (flow-t91).
  proc.unref()
  console.log(`Obsidian launched in the background (pid ${proc.pid}) — vault: ${vault ?? copiedVault}`)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
