import type { ChildProcess } from 'node:child_process'

const DEFAULT_SIGKILL_ESCALATION_MS = 5000

/**
 * Sends SIGTERM and waits for the process to exit, escalating to SIGKILL if it
 * hasn't exited within `sigkillEscalationMs`. Safe to call on an already-exited process.
 *
 * `proc` must have been spawned with `detached: true` -- termination signals the
 * whole process group (`-pid`), which only reaches the target (and any children,
 * e.g. Obsidian's GPU/renderer processes) when it's its own group leader. A
 * non-detached process has no group of its own, so `-pid` fails with ESRCH.
 */
export async function terminateProcess(
  proc: ChildProcess,
  sigkillEscalationMs: number = DEFAULT_SIGKILL_ESCALATION_MS,
): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null) {
    return
  }

  // Registered before kill() so a fast exit can't race past this listener.
  const exited = new Promise<void>((resolve) => {
    proc.once('exit', () => resolve())
  })

  // Signal the whole process group (negative pid), not just the top-level PID --
  // callers spawn with detached:true specifically so this also reaches
  // Obsidian's GPU/renderer children, not only the Electron main process a bare
  // proc.kill() would reach.
  if (proc.pid !== undefined) {
    process.kill(-proc.pid, 'SIGTERM')
  }

  const timedOut = Symbol('timed-out')
  const raceResult = await Promise.race([
    exited.then(() => undefined),
    new Promise<typeof timedOut>(resolve => setTimeout(() => resolve(timedOut), sigkillEscalationMs)),
  ])

  if (raceResult === timedOut && proc.pid !== undefined) {
    process.kill(-proc.pid, 'SIGKILL')
    await exited
  }
}
