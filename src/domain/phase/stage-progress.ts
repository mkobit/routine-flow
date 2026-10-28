import type { PhaseId, PhaseNode } from './phase'
import type { PhaseGraph } from './phase-graph'
import type { EngineState } from '../session/engine-state'

export interface StageItem {
  readonly phaseId: PhaseId
  readonly label: string
  readonly status: 'completed' | 'active' | 'upcoming'
  readonly isCurrent: boolean
}

export interface StageProgress {
  readonly stages: readonly StageItem[]
  readonly completedCount: number
  readonly totalCount: number
  readonly progressFraction: number
}

function deriveStageItem(phase: PhaseNode, state: EngineState): StageItem {
  const isCurrent = phase.id === state.currentPhaseId
  const visitCount = state.phaseVisitCounts[phase.id] ?? 0
  const status = isCurrent ? 'active' : visitCount > 0 ? 'completed' : 'upcoming'

  return {
    phaseId: phase.id,
    label: phase.label,
    status,
    isCurrent,
  }
}

/**
 * Derives an ordered sequence of stages and overall progress from routine phase graph and runtime engine state.
 */
export function deriveStageProgress(graph: PhaseGraph, state: EngineState): StageProgress {
  const stages = graph.phases.map(phase => deriveStageItem(phase, state))
  const completedCount = stages.filter(stage => stage.status === 'completed').length
  const totalCount = stages.length
  const progressFraction = totalCount > 0 ? completedCount / totalCount : 0

  return {
    stages,
    completedCount,
    totalCount,
    progressFraction,
  }
}
