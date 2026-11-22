import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { spawn } from 'node:child_process'
import { rebuildGeneratedVault, resolveVaultSeed, stripGitignoredVaultState } from './vault'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')
const VAULT_PATH = path.join(ROOT_DIR, 'routine-flow-example-vault')

/**
 * e2e/fixtures/obsidian.ts launches Obsidian against whatever main.js already sits at ROOT_DIR --
 * it doesn't rebuild from src/ itself. Without this, a stale bundle silently passes tests against
 * old code (flow-k2x; discovered when a 2-day-old main.js gave a false-green 3/3).
 */
async function rebuildPlugin(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('bun', ['run', 'build'], { cwd: ROOT_DIR, stdio: 'inherit' })
    proc.on('error', reject)
    proc.on('close', code => (code === 0 ? resolve() : reject(new Error(`bun run build exited ${code}`))))
  })
}

/** Prepares a temporary vault for the per-test fixtures to copy. */
export default async function globalSetup(): Promise<() => Promise<void>> {
  await rebuildPlugin()

  const seed = resolveVaultSeed()
  const vaultPath = await fs.mkdtemp(path.join(tmpdir(), 'routine-flow-e2e-'))
  const cleanup = () => fs.rm(vaultPath, { recursive: true, force: true })

  try {
    await fs.cp(VAULT_PATH, vaultPath, { recursive: true })
    await stripGitignoredVaultState(vaultPath)
    const errors = await rebuildGeneratedVault(vaultPath, seed)
    if (errors.length > 0) {
      throw new AggregateError(errors, `Failed to write ${errors.length} generated vault note(s)`)
    }
    // eslint-disable-next-line functional/immutable-data -- Playwright passes setup environment variables to workers.
    process.env.ROUTINE_FLOW_E2E_VAULT = vaultPath
    process.stdout.write(`Rebuilt generated vault notes in ${vaultPath} (seed=${seed})\n`)
    return cleanup
  }
  catch (error) {
    await cleanup()
    throw error
  }
}
