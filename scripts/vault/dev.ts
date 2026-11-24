#!/usr/bin/env bun
// Usage: bun run vault:dev [-- --theme <light|dark>] [--no-build] [--no-generated]
// --theme presets Obsidian's base color scheme before launch (ported from
// bases-chartkit's scripts/vault-dev.ts, same obsidian-launcher harness).
// Requires copying the vault first -- see the setupVault call below.
import ObsidianLauncher from 'obsidian-launcher'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as net from 'node:net'
import { Command, Option } from 'commander'
import { rebuildGeneratedVault, resolveVaultSeed, stripGitignoredVaultState } from '../../e2e/vault'
import { applyViewMode } from '../appearance'
import type { ViewMode } from '../appearance'
import { applyInitialWorkspace } from '../initial-workspace'
import { CACHE_DIR, ROOT_DIR, VAULT_PATH, assertBuiltArtifacts, runCli } from './shared'

import obsidianVersion from '../../e2e/obsidian-version.json' with { type: 'json' }

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

/** Allocates an ephemeral loopback port for the CDP window-resize workaround. */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close((closeErr) => {
        if (closeErr) {
          reject(closeErr)
          return
        }
        if (address !== null && typeof address === 'object') {
          resolve(address.port)
          return
        }
        reject(new Error('Failed to allocate ephemeral CDP port'))
      })
    })
  })
}

async function findObsidianPage(cdpPort: number): Promise<CdpPage | undefined> {
  try {
    const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`)
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

async function resizeWindowWhenReady(cdpPort: number, attemptsRemaining = 20): Promise<void> {
  const page = await findObsidianPage(cdpPort)
  if (page) {
    await resizeOverWebsocket(page.webSocketDebuggerUrl)
    return
  }
  if (attemptsRemaining <= 0) {
    console.error('Timed out waiting for Obsidian CDP page to resize the window.')
    return
  }
  await Bun.sleep(500)
  await resizeWindowWhenReady(cdpPort, attemptsRemaining - 1)
}

export interface DevOptions {
  readonly build: boolean
  readonly generated: boolean
  readonly headless: boolean
  readonly theme: ViewMode
  readonly open: string
}

async function runBuild(): Promise<void> {
  const proc = Bun.spawn(['bun', 'run', 'build'], {
    cwd: ROOT_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`Plugin build failed with exit code ${exitCode}`)
  }
}

async function cleanupDirs(dirs: readonly string[]): Promise<void> {
  await Promise.allSettled(dirs.map(dir => fs.rm(dir, { recursive: true, force: true })))
}

export function buildCleanupWatcherScript(): string {
  return [
    'const fs = require("node:fs/promises");',
    'const [pidStr, ...dirs] = process.argv.slice(1);',
    'const pid = Number(pidStr);',
    'if (!Number.isInteger(pid) || pid <= 0) process.exit(1);',
    'const timer = setInterval(async () => {',
    '  try {',
    '    process.kill(pid, 0);',
    '  } catch (err) {',
    '    if (err && typeof err === "object" && "code" in err && err.code === "EPERM") return;',
    '    clearInterval(timer);',
    '    await Promise.allSettled(dirs.map(dir => fs.rm(dir, { recursive: true, force: true })));',
    '    process.exit(0);',
    '  }',
    '}, 2000);',
  ].join('\n')
}

function spawnTmpdirCleanupWatcher(pid: number, dirs: readonly string[]): void {
  if (!Number.isInteger(pid) || pid <= 0) {
    return
  }
  const watcher = spawn(
    process.execPath,
    ['-e', buildCleanupWatcherScript(), String(pid), ...dirs],
    { detached: true, stdio: 'ignore' },
  )
  watcher.unref()
}

async function runDev({ build, generated, headless, theme, open }: DevOptions): Promise<void> {
  if (build) {
    await runBuild()
  }
  await assertBuiltArtifacts()

  const launcher = new ObsidianLauncher({ cacheDir: CACHE_DIR })

  // Copied to a tmpdir so interactive poking never dirties the git-tracked
  // example vault (Obsidian rewrites .base YAML and workspace state on every
  // view interaction), matching e2e/fixtures/obsidian.ts's own vault-copy
  // step. Stripped of gitignored runtime state for the same reason that
  // fixture strips it -- otherwise a local leftover interactive-session
  // state would leak into a supposedly-fresh launch. Done as its own
  // setupVault() call (rather than via launch()'s copy:true) so there's a
  // copied-but-not-yet-launched vault to generate demo notes and write the
  // --theme/--open presets into before Obsidian ever sees it.
  const copiedVault = await launcher.setupVault({ vault: VAULT_PATH, copy: true })

  try {
    await stripGitignoredVaultState(copiedVault)
    if (generated) {
      const seed = resolveVaultSeed()
      const errors = await rebuildGeneratedVault(copiedVault, seed)
      if (errors.length > 0) {
        throw new AggregateError(errors, `Failed to write ${errors.length} generated vault note(s)`)
      }
      console.log(`Rebuilt generated vault notes in ${copiedVault} (seed=${seed})`)
    }
    await applyViewMode(copiedVault, theme)
    await applyInitialWorkspace(copiedVault, open)
  }
  catch (err) {
    await cleanupDirs([copiedVault])
    throw err
  }

  const cdpPort = await getFreePort()
  const { proc, configDir, vault } = await launcher.launch({
    appVersion: obsidianVersion.appVersion,
    installerVersion: obsidianVersion.installerVersion,
    vault: copiedVault,
    // Already copied, demo-populated, and preset above -- copy:false here
    // avoids a redundant second copy of the vault.
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
      `--remote-debugging-port=${cdpPort}`,
      '--remote-allow-origins=*',
    ],
    // Headless (under xvfb-run) stays attached to the same process group so
    // this script can wait for and signal-relay to it below; real-display
    // mode detaches so the shell is handed back immediately.
    spawnOptions: { stdio: 'ignore', detached: !headless },
  })

  const activeVault = vault ?? copiedVault
  const tmpDirs = [configDir, activeVault]

  void resizeWindowWhenReady(cdpPort)

  if (headless) {
    // xvfb-run tears down its virtual display as soon as the command it
    // wraps (this script) exits -- unref-and-return-immediately would kill
    // Obsidian's display out from under it while it's still running. Wait
    // for the real exit instead, and relay termination signals so an
    // interrupted launch can't leave Obsidian orphaned against a display
    // that's about to disappear (flow-9vx).
    process.on('SIGINT', () => proc.kill('SIGINT'))
    process.on('SIGTERM', () => proc.kill('SIGTERM'))
    console.log(`Obsidian launched under Xvfb (pid ${proc.pid}) — vault: ${activeVault}. Waiting for exit...`)
    await new Promise<void>(resolve => proc.on('exit', () => resolve()))
    await cleanupDirs(tmpDirs)
    return
  }

  // Real-display mode detaches and hands the shell back immediately (by design,
  // see AGENTS.md). Spawn a tiny detached watcher that polls for Obsidian's
  // exit and removes the per-launch configDir/vault-copy tmpdirs afterwards.
  proc.unref()
  if (proc.pid !== undefined) {
    spawnTmpdirCleanupWatcher(proc.pid, tmpDirs)
  }
  console.log(`Obsidian launched in the background (pid ${proc.pid}) — vault: ${activeVault}`)
}

function toDevOptions(raw: Record<string, unknown>): DevOptions {
  const theme = raw.theme === 'light' ? 'light' : 'dark'
  return {
    build: raw.build !== false,
    generated: raw.generated !== false,
    headless: raw.headless === true,
    theme,
    open: typeof raw.open === 'string' ? raw.open : 'default',
  }
}

export function createDevProgram(onAction?: (options: DevOptions) => Promise<void> | void): Command {
  const program = new Command()
    .name('vault-dev')
    .description('Launch a provisioned Obsidian against the example vault. Opens on the real display -- for headless (Xvfb) launches, run `bun run vault:dev:headless` instead.')
    .option('--build', 'build the plugin before launching', true)
    .option('--no-build', 'skip building the plugin before launching')
    .option('--generated', 'rebuild the vault\'s generated demo notes before launching', true)
    .option('--no-generated', 'skip rebuilding the vault\'s generated demo notes before launching')
    .option('--headless', 'wait for Obsidian to exit instead of detaching -- required under xvfb-run, which tears down the virtual display as soon as the wrapped command exits', false)
    .addOption(new Option('--theme <mode>', 'preset Obsidian\'s color scheme before launch').choices(['light', 'dark']).default('dark'))
    .addOption(new Option('--open <target>', 'preset initial open view or file on launch (e.g. default, standup, workout, chore-list, manual-clear, table, shared-routines, or a vault path)').default('default'))

  if (onAction) {
    program.action(() => onAction(toDevOptions(program.opts())))
  }

  return program
}

export function parseDevOptions(argv: readonly string[]): DevOptions {
  const program = createDevProgram()
  program.exitOverride()
  program.configureOutput({ writeErr: () => {} })
  program.parse([...argv], { from: 'user' })
  return toDevOptions(program.opts())
}

if (import.meta.main) {
  runCli('vault-dev', () => createDevProgram(runDev).parseAsync())
}
