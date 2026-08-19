import { z } from 'zod'
import type { Temporal } from 'temporal-polyfill'
import type { PhaseId } from '../phase/phase'
import type { PhaseGraphId } from '../phase/phase-graph'
import type { Session } from './session'

/**
 * Whether the engine's ticker is running, paused, stopped, completed, or ended.
 * `'completed'` sits at the same phase until an explicit `advance-phase` moves on.
 * `'ended'` means a terminal node was reached and traversal finished.
 * `'stopped'` means reset to the graph's first phase.
 */
export const EngineStatusSchema = z.enum(['running', 'paused', 'stopped', 'completed', 'ended'])
export type EngineStatus = z.infer<typeof EngineStatusSchema>

/**
 * Runtime engine state for a live traversal of a PhaseGraph.
 */
export interface EngineState {
  readonly status: EngineStatus
  /** ID of the active PhaseGraph (for serialization/rehydration). */
  readonly phaseGraphId: PhaseGraphId
  readonly currentPhaseId: PhaseId
  /** Time remaining in the current phase, or null for a duration-less phase. */
  readonly remaining: Temporal.Duration | null
  /** The file path of the active task, if any. */
  readonly activeFilePath: string | null
  readonly phaseVisitCounts: Readonly<Record<PhaseId, number>>
  /** Whether the current phase's TaskSource queue is known to be empty. */
  readonly queueExhausted: boolean
  readonly session: Session | null
}
