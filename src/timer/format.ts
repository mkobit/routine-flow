import type { Temporal } from 'temporal-polyfill'
import type { Phase } from '../domain/phase/phase'
import type { EngineStatus } from '../domain/session/engine-state'

/**
 * Formats a remaining Duration as zero-padded mm:ss, or null for a
 * duration-less phase (nothing to count down). Factored out so the
 * padStart/total-seconds math lives in one place, shared by formatPhaseHeader
 * (flat string) and RoutineTimerView's structured stopwatch header.
 */
export function formatCountdown(remaining: Temporal.Duration | null): string | null {
  if (remaining === null) {
    return null
  }
  const totalSeconds = remaining.total({ unit: 'seconds' })
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
  const countdown = formatCountdown(remaining)
  if (countdown === null) {
    return `${phase.label} (${status})`
  }
  return `${phase.label}: ${countdown} (${status})`
}
