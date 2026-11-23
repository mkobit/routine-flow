#!/usr/bin/env bun
import { spawn } from 'node:child_process'
import * as path from 'node:path'
import { Command } from 'commander'
import {
  PLUGIN_ID,
  VAULT_BASENAME,
  VAULT_PATH,
  assertBuiltArtifacts,
  copyPluginArtifacts,
  runCli,
} from './shared'

function run(cmd: string, args: readonly string[], stdio: 'inherit' | 'pipe' = 'inherit'): Promise<{ readonly stdout: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, [...args], { stdio: stdio === 'inherit' ? 'inherit' : ['ignore', 'pipe', 'inherit'] })
    const chunks: Buffer[] = []
    if (proc.stdout) {
      proc.stdout.on('data', (c: Buffer) => chunks.push(c))
    }
    proc.on('error', reject)
    proc.on('close', code => code === 0
      ? resolve({ stdout: Buffer.concat(chunks).toString('utf8') })
      : reject(new Error(`${cmd} exited ${code}`)))
  })
}

// Detect Windows user's Documents folder via PowerShell, then convert to a
// WSL-accessible path. Honors OneDrive/redirected Documents. Falls back if
// we're not on WSL.
async function detectDefaultDest(): Promise<string | null> {
  try {
    const { stdout } = await run(
      'powershell.exe',
      ['-NoProfile', '-Command', '[Environment]::GetFolderPath(\'MyDocuments\')'],
      'pipe',
    )
    const winPath = stdout.replaceAll('\r', '').trim()
    if (!winPath) {
      return null
    }
    const { stdout: wslOut } = await run('wslpath', [winPath], 'pipe')
    const wslPath = wslOut.trim()
    return path.join(wslPath, VAULT_BASENAME)
  }
  catch {
    return null
  }
}

async function resolveDest(destination?: string): Promise<string> {
  if (destination) {
    return destination
  }
  const detected = await detectDefaultDest()
  if (!detected) {
    console.error('Could not auto-detect Windows Documents folder.')
    console.error('Usage: bun run vault:sync [destination]')
    console.error('  e.g. /mnt/c/Users/<you>/Documents/routine-flow-example-vault')
    process.exit(1)
  }
  return detected
}

async function runSync(destination?: string): Promise<void> {
  const dest = await resolveDest(destination)
  await assertBuiltArtifacts('run `bun run build` first')

  // Sync vault content. Excludes preserve Obsidian's per-machine workspace
  // state on the destination so the user's open tabs survive re-syncs;
  // the plugins/ dir is rewritten by the cp step below.
  await run('rsync', [
    '-av',
    '--delete',
    '--exclude=/.obsidian/workspace.json',
    '--exclude=/.obsidian/workspace-mobile.json',
    '--exclude=/.obsidian/cache',
    '--exclude=/.obsidian/plugins',
    `${VAULT_PATH}/`,
    `${dest}/`,
  ])

  // Install built plugin artifacts
  const pluginDir = path.join(dest, '.obsidian', 'plugins', PLUGIN_ID)
  await copyPluginArtifacts(pluginDir)

  console.log(`\nVault synced to: ${dest}`)
  console.log(`Plugin installed at: ${pluginDir}`)
  console.log('\nNext steps:')
  console.log('  1. Open the folder as a vault in Windows Obsidian (one-time)')
  console.log(`     File → Open another vault → Open folder as vault → ${path.basename(dest)}`)
  console.log('  2. After registration the obsidian CLI can target it:')
  console.log(`     obsidian --vault=${path.basename(dest)} vault`)
}

const program = new Command()
  .name('vault-sync')
  .description('Sync the example vault and built plugin artifacts to a local or Windows Obsidian vault.')
  .argument('[destination]', 'destination vault path (auto-detected from Windows Documents on WSL if omitted)')
  .action(runSync)

runCli('vault-sync', () => program.parseAsync())
