import { z } from 'zod'
import type { Temporal } from 'temporal-polyfill'
import type { PhaseId } from '../phase/phase'
import type { PhaseGraphId } from '../phase/phase-graph'
import type { Session } from './session'

/**
 * Whether the engine's ticker is running, paused, or stopped. `'completed'` is
 * distinct from `'stopped'` — a `manualClear`-policy phase that reaches zero
 * remaining sits here, at the same phase, until an explicit `advance-phase`
 * moves on; `'stopped'` means reset to the graph's first phase.
 */
export const EngineStatusSchema = z.enum(['running', 'paused', 'stopped', 'completed'])
export type EngineStatus = z.infer<typeof EngineStatusSchema>

/**
 * Runtime engine state for a live traversal of a PhaseGraph — the
 * PhaseGraph-based replacement for src/timer/reducer.ts's TimerState.
 *
 * `phaseVisitCounts` backs TransitionCondition's 'everyNth' case (e.g. a long
 * break every 4th cycle) — it's derived at runtime by counting phase exits,
 * not part of the static PhaseGraph config.
 *
 * `queueExhausted` backs TransitionCondition's 'queueExhausted' case, the
 * same way — the reducer itself never reads a TaskSourceRegistry (it stays
 * pure), so EngineStore snapshots the current phase's queue-empty state into
 * this field before each dispatch (see EngineStore.dispatch), and
 * resolveNextPhaseId just reads it back off state, same as phaseVisitCounts.
 *
 * `session` is `null` whenever no PhaseGraph traversal is currently open (matching
 * initialEngineState's fresh/reset state), and holds the real, engine-maintained
 * Session/PhaseInstance history once `start` opens one.
 */
export interface EngineState {
  readonly status: EngineStatus
  /** ID of the active PhaseGraph (for serialization/rehydration). */
  readonly phaseGraphId: PhaseGraphId
  readonly currentPhaseId: PhaseId
  /** Time remaining in the current phase, or null for a duration-less (manual/until-dismissed) phase. */
  readonly remaining: Temporal.Duration | null
  /** The file path of the active task, if any. */
  readonly activeFilePath: string | null
  readonly phaseVisitCounts: Readonly<Record<PhaseId, number>>
  /** Whether the current phase's TaskSource queue is known to be empty. False when there's no taskSourceId, or its TaskSource isn't registered yet. */
  readonly queueExhausted: boolean
  readonly session: Session | null
}
