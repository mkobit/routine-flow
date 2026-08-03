import type { Temporal } from 'temporal-polyfill'

/**
 * Fraction of a phase that has *elapsed*, in [0, 1]: 0 the instant a phase
 * starts (remaining === duration), 1 once it completes (remaining === 0).
 * Drives the timer panel's radial progress ring via the
 * `--routine-flow-progress` custom property (see styles.css).
 *
 * Clamped defensively: `remaining` should never exceed `duration` nor go
 * negative, but a stale snapshot must still resolve to a sane fraction rather
 * than push the ring past full or below empty.
 */
export function computeProgressFraction(duration: Temporal.Duration, remaining: Temporal.Duration): number {
  const totalSeconds = duration.total({ unit: 'seconds' })
  if (totalSeconds <= 0) {
    return 1
  }
  const remainingSeconds = remaining.total({ unit: 'seconds' })
  const elapsed = 1 - remainingSeconds / totalSeconds
  return Math.min(1, Math.max(0, elapsed))
}
