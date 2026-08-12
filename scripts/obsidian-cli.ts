// Shared helper for driving a running `vault:dev` Obsidian instance via
// Obsidian's official CLI (https://obsidian.md/help/cli) instead of raw CDP
// WebSocket framing. obsidian-launcher pre-seeds `cli: true` into the
// sandboxed instance's obsidian.json, so no Settings toggle is needed.
// Ported from bases-chartkit's scripts/obsidian-cli.ts (same obsidian-launcher
// harness).

import ObsidianLauncher from 'obsidian-launcher'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import obsidianVersion from '../e2e/obsidian-version.json' with { type: 'json' }

const ROOT_DIR = path.resolve(import.meta.dirname, '..')
const CACHE_DIR = path.join(ROOT_DIR, '.obsidian-cache')

// Mirrors the appVersion/installerVersion resolution vault-dev.ts's launch()
// call uses, so this always resolves the same installer -- and thus the same
// sibling `obsidian-cli` binary -- as whichever instance is actually running.
async function resolveCliBinary(): Promise<string> {
  const localCli = path.join(CACHE_DIR, 'obsidian-installer', 'linux-x64', `Obsidian-${obsidianVersion.installerVersion}`, 'obsidian-cli')
  try {
    await fs.access(localCli)
    return localCli
  }
  catch {
    const launcher = new ObsidianLauncher({ cacheDir: CACHE_DIR })
    const obsidianBinary = await launcher.downloadInstaller(obsidianVersion.installerVersion)
    const cliBinary = path.join(path.dirname(obsidianBinary), 'obsidian-cli')
    await fs.access(cliBinary)
    return cliBinary
  }
}

export interface ObsidianCliResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

// Runs an Obsidian CLI subcommand against the running `vault:dev` instance,
// e.g. runObsidianCli(['eval', 'code=app.vault.getName()']).
export async function runObsidianCli(args: readonly string[]): Promise<ObsidianCliResult> {
  const cliBinary = await resolveCliBinary()
  const proc = Bun.spawn([cliBinary, ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}
