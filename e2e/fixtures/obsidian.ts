import { test as base, expect, chromium } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import type { ChildProcess } from 'node:child_process'
import ObsidianLauncher from 'obsidian-launcher'
import * as path from 'node:path'
import * as net from 'node:net'
import * as fs from 'node:fs/promises'
import { stripGitignoredVaultState } from '../vault'
import { terminateProcess } from './process-lifecycle'
import obsidianVersion from '../obsidian-version.json' with { type: 'json' }

const ROOT_DIR = path.resolve(import.meta.dirname, '../../')
const VAULT_PATH = path.join(ROOT_DIR, 'routine-flow-example-vault')
const CACHE_DIR = path.join(ROOT_DIR, '.obsidian-cache')

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, () => {
      const addr = server.address()
      server.close(() => {
        if (addr !== null && typeof addr === 'object') {
          resolve(addr.port)
        }
        else {
          reject(new Error('Could not determine free port'))
        }
      })
    })
  })
}

async function waitForCDP(port: number, proc: ChildProcess): Promise<void> {
  await expect(async () => {
    if (proc.exitCode !== null) {
      throw new Error(`Obsidian process exited early with code ${proc.exitCode}`)
    }
    const browser = await chromium.connectOverCDP(`http://localhost:${port}`, { timeout: 2000 })
    await browser.close()
  }).toPass({ intervals: [1000], timeout: 30_000 })
}

export type ObsidianPage = {
  readonly page: Page
  /** Path to the (per-test, `copy: true`) vault actually running — writes here are picked up by the running Obsidian instance. */
  readonly vaultPath: string
}

type ObsidianResources = ObsidianPage & {
  readonly proc: ChildProcess
  readonly browser: Browser
  readonly configDir: string
}

/**
 * obsidian-launcher doesn't clean up the configDir/vault-copy tmpdirs it creates
 * per launch -- without this, every test run leaks a fresh configDir and vault
 * copy into the OS tmpdir forever (confirmed: ~280MB across 100+ leaked dirs in
 * /tmp from prior runs before this fix). `vaultPath` is only removed when it's
 * the per-test copy, never the git-tracked VAULT_PATH.
 */
async function cleanupObsidianTmpdirs(configDir: string, vaultPath: string): Promise<void> {
  const results = await Promise.allSettled([
    fs.rm(configDir, { recursive: true, force: true }),
    vaultPath === VAULT_PATH ? Promise.resolve() : fs.rm(vaultPath, { recursive: true, force: true }),
  ])
  for (const result of results) {
    if (result.status === 'rejected') {
      process.stderr.write(`obsidian tmpdir cleanup failed: ${String(result.reason)}\n`)
    }
  }
}

/**
 * Launches Obsidian and waits for it to be ready to drive over CDP. `connectPort`
 * defaults to `listenPort` (the port Obsidian was actually told to listen on) but can be
 * overridden to point at a port nothing is listening on, to exercise the failure path.
 *
 * Self-cleaning on failure: if any step here throws, the already-spawned process is
 * terminated before the error propagates, so a setup failure can never leak a live
 * Obsidian process. Callers are only responsible for cleanup on the success path
 * (see `releaseObsidian`).
 *
 * `onProcSpawned`, if given, fires as soon as the process exists -- so a test that
 * deliberately forces the failure path can still observe the process it needs to
 * assert was cleaned up, since the failure path never returns one.
 */
async function acquireObsidian(
  listenPort: number,
  connectPort: number = listenPort,
  onProcSpawned?: (proc: ChildProcess) => void,
): Promise<ObsidianResources> {
  const launcher = new ObsidianLauncher({ cacheDir: CACHE_DIR })

  // launcher.setupVault's copy is a plain recursive fs.cp -- it doesn't know about
  // .gitignore, so the per-test copy is stripped of gitignored runtime state
  // (.obsidian/workspace.json, .obsidian/plugins/, etc.) before Obsidian ever sees it.
  // Otherwise a local dev machine's leftover interactive-session state can silently
  // leak into every test and diverge from what a fresh checkout/CI produces.
  const copiedVault = await launcher.setupVault({ vault: VAULT_PATH, copy: true })
  await stripGitignoredVaultState(copiedVault)

  const { proc, configDir, vault } = await launcher.launch({
    appVersion: obsidianVersion.appVersion,
    installerVersion: obsidianVersion.installerVersion,
    vault: copiedVault,
    copy: false,
    plugins: [ROOT_DIR],
    // Avoids the "GPU process isn't usable" FATAL abort under sustained CDP+canvas
    // activity in WSL2/Xvfb (flow-1la): bare --disable-gpu alone still spawns a GPU
    // process for OOP rasterization via SwiftShader, which can hit Chromium's
    // GPU-process crash-retry ceiling just as fast or faster than with no flag at
    // all. These four keep Chromium off that GPU-process path entirely for canvas
    // compositing instead. Root-caused and validated (3 consecutive clean e2e
    // trials, then a week+ of clean use in production) in the sibling bases-chartkit
    // repo, which shares this exact obsidian-launcher/Playwright harness -- see
    // bck-to4/bck-cyz there. A workaround for the crash-retry ceiling, not a fix for
    // the underlying WSL2/Xvfb GL-context failure itself.
    args: [
      `--remote-debugging-port=${listenPort}`,
      '--disable-gpu',
      '--disable-gpu-compositing',
      '--disable-software-rasterizer',
      '--disable-gpu-sandbox',
    ],
    // detached:true makes this process its own group leader so terminateProcess
    // can SIGTERM/SIGKILL the whole group (including GPU/renderer children), not
    // just the top-level PID.
    spawnOptions: { stdio: 'pipe', detached: true },
  })
  onProcSpawned?.(proc)
  const vaultPath = vault ?? VAULT_PATH

  try {
    if (proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => process.stderr.write(`[obsidian] ${data.toString()}`))
    }

    await waitForCDP(connectPort, proc)

    const browser = await chromium.connectOverCDP(`http://localhost:${connectPort}`)
    const context = browser.contexts()[0] ?? await browser.newContext()
    const page = context.pages()[0] ?? await context.newPage()

    await page.waitForFunction(
      () => typeof window.app !== 'undefined',
      { timeout: 30_000 },
    )

    // window.app existing only means the renderer booted -- workspace.json-driven leaf restore
    // (e.g. the Tasks.base leaf) is a separate, later async step that can still be in flight here.
    // workspace.layoutReady is Obsidian's own public signal that restore has finished.
    await page.waitForFunction(
      () => window.app!.workspace.layoutReady,
      { timeout: 30_000 },
    )

    // Wait for the routine-flow plugin to be loaded into Obsidian's plugin registry
    await page.waitForFunction(
      () => window.app!.plugins?.plugins['routine-flow'] !== undefined,
      { timeout: 30_000 },
    )

    return { proc, browser, page, vaultPath, configDir }
  }
  catch (err) {
    await terminateProcess(proc)
    await cleanupObsidianTmpdirs(configDir, vaultPath)
    throw err
  }
}

async function releaseObsidian({ proc, browser, configDir, vaultPath }: ObsidianResources): Promise<void> {
  try {
    await browser.close()
  }
  finally {
    await terminateProcess(proc)
    await cleanupObsidianTmpdirs(configDir, vaultPath)
  }
}

type ObsidianFixtures = {
  readonly obsidianPage: ObsidianPage
}

export const test = base.extend<ObsidianFixtures>({
  obsidianPage: async ({}, use) => {
    const port = await findFreePort()
    const resources = await acquireObsidian(port)

    try {
      await use({ page: resources.page, vaultPath: resources.vaultPath })
    }
    finally {
      await releaseObsidian(resources)
    }
  },
})

export { acquireObsidian, findFreePort }

export { expect }
