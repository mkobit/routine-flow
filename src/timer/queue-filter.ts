import type { BasesPropertyId } from 'obsidian'
import type { Phase } from '../domain/phase/phase'
import { FOCUS_PHASE_KIND } from './phase-graph'
import type { BaseQueryEntry } from './base-query-task-source'

/**
 * getViewOptions' declared `default: 'note.type'` for focusProperty/breakProperty is only used
 * by Obsidian's settings UI to pre-fill the field — config.getAsPropertyId() returns null until a
 * user explicitly sets it in the .base file, with no fallback to that declared default applied
 * automatically. Without this, an unconfigured view's propId resolution silently fails and the
 * queue filter falls through to "show every vault note" (found via e2e, flow-djx).
 */
const DEFAULT_QUEUE_PROPERTY_ID: BasesPropertyId = 'note.type'

/** The exact subset of BasesViewConfig this module reads — deliberately not the real class, so it's mockable with a plain object in tests. */
export interface QueueFilterConfigSource {
  readonly get: (key: string) => unknown
  readonly getAsPropertyId: (key: string) => BasesPropertyId | null
}

/**
 * The exact shape a candidate entry needs for filtering — deliberately not the real Bases
 * `BasesEntry` (mirrors BaseQueryEntry's minimal-surface rationale). `getValue` returns whatever
 * Bases' own `Value | null` reduces to for this module's purposes: something stringifiable, or null.
 */
export interface QueueFilterCandidate extends BaseQueryEntry {
  readonly getValue: (propId: BasesPropertyId) => { toString: () => string } | null
}

/**
 * Resolves which property/value a phase's queue filters on (isFocus -> propId/targetVal
 * resolution) and applies it to `candidates`, returning only the matching entries. Pulled out of
 * RoutineTimerView.buildTaskSource so this logic — including the unconfigured-View-Option
 * fallback that previously regressed silently (flow-djx) — is unit-testable with plain fakes
 * instead of only via slow e2e (flow-kg3).
 */
export function filterQueueCandidates(
  phase: Pick<Phase, 'kind'>,
  config: QueueFilterConfigSource | undefined,
  candidates: readonly QueueFilterCandidate[],
): BaseQueryEntry[] {
  const isFocus = phase.kind === FOCUS_PHASE_KIND
  const propId = (isFocus ? config?.getAsPropertyId('focusProperty') : config?.getAsPropertyId('breakProperty')) ?? DEFAULT_QUEUE_PROPERTY_ID
  const rawTargetVal = isFocus ? config?.get('focusValue') : config?.get('breakValue')
  const targetValFallback = isFocus ? 'work' : 'break'
  const targetVal = typeof rawTargetVal === 'string' && rawTargetVal ? rawTargetVal : targetValFallback

  return candidates
    .filter((candidate) => {
      const valObj = candidate.getValue(propId)
      const valStr = valObj ? valObj.toString() : ''
      return valStr.toLowerCase() === targetVal.toLowerCase()
    })
    .map(({ path, basename, frontmatter }) => ({ path, basename, frontmatter }))
}
