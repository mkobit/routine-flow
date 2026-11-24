#!/usr/bin/env bun
// Usage: bun run vault:install [-- --vault <path-or-name>] [--no-build] [--enable] [--reload]
// Non-destructively installs built plugin artifacts into a live Obsidian vault.

import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { Command } from 'commander'
import {
  PLUGIN_ID,
  ROOT_DIR,
  assertBuiltArtifacts,
  copyPluginArtifacts,
  runCli,
  runObsidianCli,
} from './shared'
import type { ObsidianCliResult } from './shared'

export interface InstallOptions {
  readonly vault?: string
  readonly build: boolean
  readonly enable: boolean
  readonly reload: boolean
}

export interface ObsidianVaultEntry {
  readonly id: string
  readonly path: string
  readonly name: string
  readonly open: boolean
}

export interface InstallDependencies {
  readonly configPathFn?: () => string
  readonly buildFn?: () => Promise<void>
  readonly assertArtifactsFn?: () => Promise<void>
  readonly copyFn?: (pluginDir: string) => Promise<void>
  readonly reloadFn?: () => Promise<ObsidianCliResult>
}

export interface InstallResult {
  readonly vaultPath: string
  readonly pluginDir: string
  readonly enabled: boolean
  readonly reloaded: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isErrnoException(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && 'code' in value
}

async function isExistingDirectory(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath)
    return stat.isDirectory()
  }
  catch {
    return false
  }
}

/**
 * Resolves the platform-specific path to Obsidian's `obsidian.json` registry.
 */
export function getObsidianConfigPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homeDir: string = os.homedir(),
): string {
  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'obsidian', 'obsidian.json')
  }
  if (platform === 'win32') {
    const appData = env.APPDATA || path.join(homeDir, 'AppData', 'Roaming')
    return path.join(appData, 'obsidian', 'obsidian.json')
  }
  const configHome = env.XDG_CONFIG_HOME || path.join(homeDir, '.config')
  return path.join(configHome, 'obsidian', 'obsidian.json')
}

/**
 * Reads registered vaults from Obsidian's `obsidian.json` file.
 */
export async function readObsidianVaults(configPath: string): Promise<readonly ObsidianVaultEntry[]> {
  try {
    const raw = await fs.readFile(configPath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || !isRecord(parsed.vaults)) {
      return []
    }
    return Object.entries(parsed.vaults).flatMap(([id, entry]): readonly ObsidianVaultEntry[] => {
      if (!isRecord(entry) || typeof entry.path !== 'string' || entry.path.length === 0) {
        return []
      }
      return [{
        id,
        path: entry.path,
        name: path.basename(entry.path),
        open: entry.open === true,
      }]
    })
  }
  catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') {
      return []
    }
    throw err
  }
}

function formatVaultList(vaults: readonly ObsidianVaultEntry[]): string {
  return vaults
    .map(vault => `  - ${vault.name} (${vault.path})${vault.open ? ' [open]' : ''}`)
    .join('\n')
}

/**
 * Resolves a target vault path from `--vault <path-or-name>` or `obsidian.json`.
 */
export async function resolveVaultPath(
  vaultArg: string | undefined,
  configPath: string = getObsidianConfigPath(),
): Promise<string> {
  if (vaultArg !== undefined) {
    const resolved = path.resolve(vaultArg)
    if (await isExistingDirectory(resolved)) {
      return resolved
    }

    const vaults = await readObsidianVaults(configPath)
    const matches = vaults.filter(vault => vault.name === vaultArg)
    const [firstMatch] = matches
    if (matches.length === 1 && firstMatch !== undefined) {
      return firstMatch.path
    }
    if (matches.length > 1) {
      throw new Error(
        `Multiple vaults named "${vaultArg}" found in ${configPath}:\n${formatVaultList(matches)}\nPass the full vault path to --vault instead.`,
      )
    }
    if (vaults.length === 0) {
      throw new Error(
        `Vault "${vaultArg}" is not an existing directory and no vaults were found in ${configPath}.`,
      )
    }
    throw new Error(
      `Vault "${vaultArg}" not found as a directory or in ${configPath}.\nAvailable vaults:\n${formatVaultList(vaults)}`,
    )
  }

  const vaults = await readObsidianVaults(configPath)
  const [onlyVault] = vaults
  if (vaults.length === 0 || onlyVault === undefined) {
    throw new Error(`No vaults found in ${configPath}. Pass --vault <path-or-name> explicitly.`)
  }
  if (vaults.length === 1) {
    return onlyVault.path
  }

  const openVaults = vaults.filter(vault => vault.open)
  const [singleOpenVault] = openVaults
  if (openVaults.length === 1 && singleOpenVault !== undefined) {
    return singleOpenVault.path
  }

  const reason = openVaults.length === 0 ? 'none are marked open' : 'multiple are marked open'
  throw new Error(
    `Multiple vaults found in ${configPath} and ${reason}.\nPass --vault <path-or-name> to select one:\n${formatVaultList(vaults)}`,
  )
}

/**
 * Verifies that `vaultPath` contains an `.obsidian` directory.
 */
export async function assertObsidianVault(vaultPath: string): Promise<void> {
  const obsidianDir = path.join(vaultPath, '.obsidian')
  if (!(await isExistingDirectory(obsidianDir))) {
    throw new Error(`Target directory is not an Obsidian vault (missing .obsidian directory): ${vaultPath}`)
  }
}

/**
 * Appends `pluginId` to `<vaultPath>/.obsidian/community-plugins.json` if not already present.
 * Returns `true` when the file was updated, or `false` when already enabled.
 */
export async function enableCommunityPlugin(
  vaultPath: string,
  pluginId: string = PLUGIN_ID,
): Promise<boolean> {
  const communityPluginsPath = path.join(vaultPath, '.obsidian', 'community-plugins.json')
  const existing = await readCommunityPlugins(communityPluginsPath, vaultPath)
  if (existing.includes(pluginId)) {
    return false
  }
  const updated = [...existing, pluginId]
  await fs.writeFile(communityPluginsPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8')
  return true
}

async function readCommunityPlugins(
  communityPluginsPath: string,
  vaultPath: string,
): Promise<readonly string[]> {
  try {
    const raw = await fs.readFile(communityPluginsPath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every((item): item is string => typeof item === 'string')) {
      throw new Error(`Invalid community-plugins.json in ${vaultPath}: expected a JSON array of strings.`)
    }
    return parsed
  }
  catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') {
      return []
    }
    throw err
  }
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

/**
 * Builds (unless disabled), verifies artifacts, resolves the target vault,
 * copies plugin artifacts, and optionally enables and reloads the plugin.
 */
export async function installToVault(
  options: InstallOptions,
  deps: InstallDependencies = {},
): Promise<InstallResult> {
  const buildFn = deps.buildFn ?? runBuild
  const assertArtifactsFn = deps.assertArtifactsFn ?? (() => assertBuiltArtifacts())
  const copyFn = deps.copyFn ?? copyPluginArtifacts
  const reloadFn = deps.reloadFn ?? (() => runObsidianCli(['plugin:reload', `id=${PLUGIN_ID}`]))

  if (options.build) {
    await buildFn()
  }
  await assertArtifactsFn()

  const configPath = (deps.configPathFn ?? getObsidianConfigPath)()
  const vaultPath = await resolveVaultPath(options.vault, configPath)
  await assertObsidianVault(vaultPath)

  const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', PLUGIN_ID)
  await copyFn(pluginDir)

  const enabled = options.enable ? await enableCommunityPlugin(vaultPath, PLUGIN_ID) : false

  if (options.reload) {
    const { stdout, stderr, exitCode } = await reloadFn()
    if (exitCode !== 0) {
      throw new Error(stderr || `obsidian-cli plugin:reload failed with exit code ${exitCode}`)
    }
    if (stdout) {
      console.log(stdout)
    }
  }

  return {
    vaultPath,
    pluginDir,
    enabled,
    reloaded: options.reload,
  }
}

async function runInstall(options: InstallOptions): Promise<void> {
  const result = await installToVault(options)
  console.log(`Installed ${PLUGIN_ID} to ${result.pluginDir}`)
  if (options.enable) {
    console.log(result.enabled
      ? `Enabled ${PLUGIN_ID} in community-plugins.json`
      : `${PLUGIN_ID} was already enabled in community-plugins.json`)
  }
  if (result.reloaded) {
    console.log(`Reloaded ${PLUGIN_ID}`)
  }
}

function toInstallOptions(raw: Record<string, unknown>): InstallOptions {
  return {
    ...(typeof raw.vault === 'string' ? { vault: raw.vault } : {}),
    build: raw.build !== false,
    enable: raw.enable === true,
    reload: raw.reload === true,
  }
}

export function createInstallProgram(onAction?: (options: InstallOptions) => Promise<void> | void): Command {
  const program = new Command()
    .name('vault-install')
    .description('Non-destructively install built plugin artifacts into a live Obsidian vault.')
    .option('--vault <path-or-name>', 'target Obsidian vault path or registered vault name')
    .option('--build', 'build the plugin before installing', true)
    .option('--no-build', 'skip building the plugin before installing')
    .option('--enable', 'add routine-flow to .obsidian/community-plugins.json if not already present', false)
    .option('--reload', 'reload the plugin in the running Obsidian instance via obsidian-cli', false)

  if (onAction) {
    program.action(() => onAction(toInstallOptions(program.opts())))
  }

  return program
}

export function parseInstallOptions(argv: readonly string[]): InstallOptions {
  const program = createInstallProgram()
  program.exitOverride()
  program.configureOutput({ writeErr: () => {} })
  program.parse([...argv], { from: 'user' })
  return toInstallOptions(program.opts())
}

if (import.meta.main) {
  runCli('vault-install', () => createInstallProgram(runInstall).parseAsync())
}
