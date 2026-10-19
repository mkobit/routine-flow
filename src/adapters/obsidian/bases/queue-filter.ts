import type { BasesPropertyId } from 'obsidian'
import type { Temporal } from 'temporal-polyfill'
import type { Phase } from '../../../domain/phase/phase'
import { FOCUS_PHASE_KIND, SELECTOR_PHASE_KIND } from '../../../timer/phase-graph-query'
import type { BaseQueryEntry } from './query-task-source'
import { isDeferredInFuture, resolveNow } from './query-task-source'

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
 * Resolves which property/value a phase's queue filters on (phase.queryFilter, or isFocus -> propId/targetVal
 * fallback) and applies it to `candidates`, returning only the matching entries.
 */
export function filterQueueCandidates(
  phase: Pick<Phase, 'kind'> & Partial<Pick<Phase, 'taskSourceId' | 'queryFilter'>>,
  config: QueueFilterConfigSource | undefined,
  candidates: readonly QueueFilterCandidate[],
  now?: Temporal.Instant | (() => Temporal.Instant),
): BaseQueryEntry[] {
  const isFocus = phase.kind === FOCUS_PHASE_KIND || phase.kind === SELECTOR_PHASE_KIND
  const targetValFallback = isFocus ? 'work' : 'break'

  const propId: BasesPropertyId
    = phase.queryFilter?.property
      ?? (isFocus ? config?.getAsPropertyId('focusProperty') : config?.getAsPropertyId('breakProperty'))
      ?? DEFAULT_QUEUE_PROPERTY_ID

  const rawTargetVal
    = phase.queryFilter?.value
      ?? (isFocus ? config?.get('focusValue') : config?.get('breakValue'))
  const targetVal = typeof rawTargetVal === 'string' && rawTargetVal ? rawTargetVal : targetValFallback
  const evaluationTime = resolveNow(now)

  return candidates
    .filter((candidate) => {
      if (isDeferredInFuture(candidate.frontmatter, evaluationTime)) {
        return false
      }
      const valObj = candidate.getValue(propId)
      const valStr = valObj ? valObj.toString() : ''
      return valStr.toLowerCase() === targetVal.toLowerCase()
    })
    .map(({ path, basename, frontmatter }) => ({ path, basename, frontmatter }))
}
