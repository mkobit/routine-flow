import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { runObsidianCli } from '../obsidian-cli'

export { runObsidianCli }
export type { ObsidianCliResult } from '../obsidian-cli'

export const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..')
export const VAULT_BASENAME = 'routine-flow-example-vault'
export const VAULT_PATH = path.join(ROOT_DIR, VAULT_BASENAME)
export const CACHE_DIR = path.join(ROOT_DIR, '.obsidian-cache')
export const PLUGIN_ID = 'routine-flow'
export const PLUGIN_ARTIFACTS = ['main.js', 'manifest.json', 'styles.css'] as const

/**
 * Verifies that all built plugin artifacts exist at the repo root, exiting with
 * code 1 and a remediation hint if any artifact is missing.
 */
export async function assertBuiltArtifacts(buildHint = 'run `bun run build` first'): Promise<void> {
  await Promise.all(PLUGIN_ARTIFACTS.map(async (file) => {
    try {
      await fs.access(path.join(ROOT_DIR, file))
    }
    catch {
      console.error(`Missing ${file} at repo root — ${buildHint}`)
      process.exit(1)
    }
  }))
}

/**
 * Copies built plugin artifacts from the repo root into `pluginDir`.
 */
export async function copyPluginArtifacts(pluginDir: string): Promise<void> {
  await fs.mkdir(pluginDir, { recursive: true })
  await Promise.all(PLUGIN_ARTIFACTS.map(file =>
    fs.cp(path.join(ROOT_DIR, file), path.join(pluginDir, file))))
}

/**
 * Queries the running `vault:dev` Obsidian instance for its active vault base path.
 */
export async function resolveRunningVaultPath(): Promise<string> {
  const { stdout, stderr, exitCode } = await runObsidianCli(['eval', 'code=app.vault.adapter.getBasePath()'])
  if (exitCode !== 0 || !stdout) {
    throw new Error(stderr || 'Could not resolve the running vault\'s path — is `bun run vault:dev` running?')
  }
  // obsidian-cli prints eval results as `=> <value>`.
  return stdout.replace(/^=>\s*/, '')
}

/**
 * Runs a Commander CLI entrypoint and exits with code 1 on unhandled errors.
 */
export function runCli(name: string, fn: () => Promise<unknown>): void {
  fn().catch((err: unknown) => {
    console.error(`Fatal error in ${name}:`, err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
