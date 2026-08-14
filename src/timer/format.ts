import type { Temporal } from 'temporal-polyfill'
import type { Phase, TimeFormat } from '../domain/phase/phase'
import type { EngineStatus } from '../domain/session/engine-state'

/**
 * Formats a remaining Duration according to timeFormat ('mm:ss', 'hh:mm:ss', 'ss.s', 'ms'),
 * defaulting to 'mm:ss', or null for a duration-less phase.
 */
export function formatCountdown(
  remaining: Temporal.Duration | null,
  timeFormat: TimeFormat = 'mm:ss',
): string | null {
  if (remaining === null) {
    return null
  }
  const totalMs = remaining.total({ unit: 'milliseconds' })
  const totalSeconds = remaining.total({ unit: 'seconds' })

  if (timeFormat === 'ms') {
    return `${Math.floor(totalMs)}ms`
  }
  if (timeFormat === 'ss.s') {
    return `${(totalMs / 1000).toFixed(1)}s`
  }
  if (timeFormat === 'hh:mm:ss') {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0')
    const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
    const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0')
    return `${hours}:${mins}:${secs}`
  }

  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
}

/**
 * Formats a phase's label, remaining time, and status into one display
 * string, e.g. "Focus: 24:59 (running)" or "Standup turn (running)" for a
 * duration-less phase. Shared by every surface that mirrors the active
 * phase (RoutineTimerView, the workspace-wide status bar item).
 */
export function formatPhaseHeader(phase: Phase, remaining: Temporal.Duration | null, status: EngineStatus): string {
  const countdown = formatCountdown(remaining, phase.timeFormat ?? 'mm:ss')
  if (countdown === null) {
    return `${phase.label} (${status})`
  }
  return `${phase.label}: ${countdown} (${status})`
}
