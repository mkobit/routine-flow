import { describe, expect, it } from 'bun:test'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { buildCleanupWatcherScript, parseDevOptions } from '../../scripts/vault/dev'

describe('parseDevOptions', () => {
  it('defaults build and generated to true, headless to false, theme to dark, and open to default', () => {
    expect(parseDevOptions([])).toEqual({
      build: true,
      generated: true,
      headless: false,
      theme: 'dark',
      open: 'default',
    })
  })

  it('supports --no-build and --build', () => {
    expect(parseDevOptions(['--no-build']).build).toBe(false)
    expect(parseDevOptions(['--build']).build).toBe(true)
  })

  it('supports --no-generated and --generated', () => {
    expect(parseDevOptions(['--no-generated']).generated).toBe(false)
    expect(parseDevOptions(['--generated']).generated).toBe(true)
  })

  it('supports --headless, --theme, and --open together', () => {
    expect(parseDevOptions([
      '--no-build',
      '--no-generated',
      '--headless',
      '--theme',
      'light',
      '--open',
      'standup',
    ])).toEqual({
      build: false,
      generated: false,
      headless: true,
      theme: 'light',
      open: 'standup',
    })
  })

  it('rejects invalid --theme values', () => {
    expect(() => parseDevOptions(['--theme', 'sepia'])).toThrow()
  })
})

describe('buildCleanupWatcherScript', () => {
  it('removes target directories after the watched process exits', async () => {
    const dirA = await fs.mkdtemp(path.join(tmpdir(), 'vault-dev-watch-a-'))
    const dirB = await fs.mkdtemp(path.join(tmpdir(), 'vault-dev-watch-b-'))
    await fs.writeFile(path.join(dirA, 'marker.txt'), 'test')

    // Spawn a short-lived process that exits immediately, then run the watcher against its pid.
    const target = spawn(process.execPath, ['-e', 'process.exit(0)'])
    await new Promise<void>(resolve => target.once('exit', () => resolve()))

    const pid = target.pid
    expect(pid).toBeDefined()

    const watcher = spawn(
      process.execPath,
      ['-e', buildCleanupWatcherScript(), String(pid), dirA, dirB],
      { stdio: 'ignore' },
    )
    const exitCode = await new Promise<number | null>(resolve => watcher.once('exit', resolve))
    expect(exitCode).toBe(0)

    expect(existsSync(dirA)).toBe(false)
    expect(existsSync(dirB)).toBe(false)
  })
})
