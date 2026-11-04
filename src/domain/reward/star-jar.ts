import type { PhaseGraph, PhaseTransition } from '../phase/phase-graph'
import type { PhaseNode } from '../phase/phase'

export interface StarJarState {
  readonly current: number
  readonly target: number
  readonly progressFraction: number
  readonly isFull: boolean
}

/**
 * Derives current star/point bank values and progress from frontmatter properties.
 * Reads 'stars' (or 'points' / 'current' / 'balance') and 'target' (or 'threshold' / 'goal' / 'max').
 */
export function deriveStarJarState(
  frontmatter?: Readonly<Record<string, unknown>>,
  fallbackTarget = 15,
): StarJarState {
  const rawCurrent = frontmatter?.stars ?? frontmatter?.points ?? frontmatter?.current ?? frontmatter?.balance
  const current = typeof rawCurrent === 'number' && Number.isFinite(rawCurrent)
    ? Math.max(0, Math.floor(rawCurrent))
    : 0

  const rawTarget = frontmatter?.target ?? frontmatter?.threshold ?? frontmatter?.goal ?? frontmatter?.max
  const target = typeof rawTarget === 'number' && Number.isFinite(rawTarget) && rawTarget > 0
    ? Math.floor(rawTarget)
    : fallbackTarget

  const progressFraction = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0
  const isFull = current >= target

  return {
    current,
    target,
    progressFraction,
    isFull,
  }
}

function extractTransitionTrackerPath(transition: PhaseTransition): string | null {
  const params = transition.guard.kind === 'custom' ? transition.guard.params : undefined
  const rawTrackerFilePath = params?.trackerFilePath
  const fromTrackerFilePath = typeof rawTrackerFilePath === 'string' && rawTrackerFilePath.length > 0
    ? rawTrackerFilePath
    : null
  const rawTrackerFile = params?.trackerFile
  const fromTrackerFile = typeof rawTrackerFile === 'string' && rawTrackerFile.length > 0
    ? rawTrackerFile
    : null
  return fromTrackerFilePath ?? fromTrackerFile
}

/**
 * Resolves the tracker file path associated with a routine graph, checking graph-level
 * trackerFilePath first, then custom transition guard parameters.
 */
export function resolveGraphTrackerFilePath(graph: PhaseGraph): string | null {
  const fromGraph = typeof graph.trackerFilePath === 'string' && graph.trackerFilePath.length > 0
    ? graph.trackerFilePath
    : null
  return fromGraph ?? graph.transitions.map(extractTransitionTrackerPath).find(path => path !== null) ?? null
}

/**
 * Checks whether a routine phase graph has an associated tracker file.
 */
export function hasAssociatedTracker(graph: PhaseGraph): boolean {
  return resolveGraphTrackerFilePath(graph) !== null
}

/**
 * Checks whether a given phase represents a reward or celebration phase.
 * Detects 'resetReward' preset handlers or 'prize' / 'reward' in the phase id or name.
 */
export function isRewardPhase(phase: PhaseNode | undefined): boolean {
  const allHandlers = phase
    ? [
        ...(phase.handlers.onEnter ?? []),
        ...(phase.handlers.onExit ?? []),
        ...(phase.handlers.onComplete ?? []),
      ]
    : []
  const hasResetReward = allHandlers.some(
    handler => handler.kind === 'preset' && handler.preset === 'resetReward',
  )

  const idLower = phase ? phase.id.toLowerCase() : ''
  const labelLower = phase ? (phase.label ?? '').toLowerCase() : ''
  const nameLower = phase ? (phase.name ?? '').toLowerCase() : ''

  const matchesKeyword = idLower.includes('prize')
    || idLower.includes('reward')
    || labelLower.includes('prize')
    || labelLower.includes('reward')
    || nameLower.includes('prize')
    || nameLower.includes('reward')

  return phase !== undefined && (hasResetReward || matchesKeyword)
}
