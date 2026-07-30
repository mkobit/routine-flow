import { test, expect, describe } from 'bun:test'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { terminateProcess } from '../e2e/fixtures/process-lifecycle'

const READY_MARKER = 'ready'

/** Waits for `proc` to write `READY_MARKER` to stdout, so callers can't race the
 * child's startup (e.g. sending SIGTERM before its handler is registered). */
function waitForReady(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    proc.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes(READY_MARKER)) {
        resolve()
      }
    })
  })
}

describe('terminateProcess', () => {
  test('resolves immediately for an already-exited process', async () => {
    const proc = spawn('bun', ['-e', 'process.exit(0)'])
    await new Promise<void>(resolve => proc.once('exit', () => resolve()))

    await terminateProcess(proc)

    expect(proc.exitCode).toBe(0)
  })

  test('exits via SIGTERM when the process cooperates', async () => {
    // detached:true, matching real callers -- terminateProcess signals the process
    // group (-pid), which only reaches the target when it's its own group leader.
    const proc = spawn('bun', ['-e', `console.log('${READY_MARKER}'); setInterval(() => {}, 1000)`], { detached: true })
    await waitForReady(proc)

    await terminateProcess(proc, 5000)

    expect(proc.signalCode).toBe('SIGTERM')
  })

  test('escalates to SIGKILL if the process ignores SIGTERM', async () => {
    const proc = spawn('bun', ['-e', `process.on('SIGTERM', () => {}); console.log('${READY_MARKER}'); setInterval(() => {}, 1000)`], { detached: true })
    await waitForReady(proc)

    await terminateProcess(proc, 200)

    expect(proc.signalCode).toBe('SIGKILL')
  })
})
