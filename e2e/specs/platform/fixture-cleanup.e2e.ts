import { test, expect } from '@playwright/test'
import type { ChildProcess } from 'node:child_process'
import { acquireObsidian, findFreePort } from '../../fixtures/obsidian'

function isRunning(pid: number): boolean {
  try {
    // Signal 0 does no killing -- it only probes whether the pid exists and is
    // reachable, throwing ESRCH if not.
    process.kill(pid, 0)
    return true
  }
  catch {
    return false
  }
}

test.describe('Obsidian subprocess cleanup', () => {
  test('terminates the spawned process when setup fails before becoming ready', async () => {
    const listenPort = await findFreePort()
    // Nothing listens on this port -- connectOverCDP against it can never succeed,
    // forcing the same setup-path failure a hung/crashed Obsidian boot would cause.
    const wrongConnectPort = await findFreePort()

    let spawnedProc: ChildProcess | undefined

    await expect(
      acquireObsidian(listenPort, wrongConnectPort, (proc) => { spawnedProc = proc }),
    ).rejects.toThrow()

    expect(spawnedProc).toBeDefined()
    expect(spawnedProc?.pid).toBeDefined()
    expect(isRunning(spawnedProc!.pid!)).toBe(false)
  })
})
