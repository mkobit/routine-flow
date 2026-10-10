import type { PhaseGraph, PhaseGraphId } from '../domain/phase/phase-graph'
import type { EngineStatus } from '../domain/session/engine-state'
import { parseRoutineFile } from '../domain/routine/routine-file'
import type { RoutineParseError } from '../domain/routine/routine-file'
import type { CadenceContext, CadenceRule } from '../domain/routine/cadence-selection'
import { resolveCadenceRoutine } from '../domain/routine/cadence-selection'
import type { EngineAction } from './reducer'

/**
 * A view's resolved routine, across the states between "nothing configured"
 * and "file read and parsed". `default` and `loading` are view/async-layer
 * concerns `parseRoutineFile` itself doesn't know about.
 */
export type RoutineResolution
  = | { readonly kind: 'default', readonly graph: PhaseGraph }
    | { readonly kind: 'loading' }
    | { readonly kind: 'loaded', readonly graph: PhaseGraph }
    | { readonly kind: 'error', readonly error: RoutineParseError }

/** Parses an already-read routine file's content into a loaded routine or an inline-renderable error. */
export function resolveRoutineGraph(fileContent: string): RoutineResolution {
  const result = parseRoutineFile(fileContent)
  return result.success ? { kind: 'loaded', graph: result.graph } : { kind: 'error', error: result.error }
}

/**
 * Whether clicking Start should load+start immediately, or confirm first.
 * "Session in progress" is any status other than 'stopped' (the fresh state
 * setGraph itself produces) — a paused or completed session still holds
 * meaningful progress a silent switch would discard, not just a literal
 * EngineStatus 'running' check (see design.md's Risks section).
 */
export function decideStartAction(
  active: { readonly graphId: PhaseGraphId, readonly status: EngineStatus },
  requestedGraphId: PhaseGraphId,
): 'start' | 'confirm' {
  const sessionInProgress = active.status !== 'stopped'
  const sameRoutine = active.graphId === requestedGraphId
  return sessionInProgress && !sameRoutine ? 'confirm' : 'start'
}

export type CadenceLaunchResult = 'started' | 'cancelled' | 'no-match' | 'parse-error' | 'file-not-found'

export interface CadenceLauncherDeps {
  readonly readRoutineFile: (path: string) => Promise<string | null>
  readonly getActiveRoutine: () => { readonly graphId: PhaseGraphId, readonly graphName: string, readonly status: EngineStatus }
  readonly confirmReplace: (currentRoutineName: string, nextRoutineName: string) => Promise<'confirmed' | 'cancelled'>
  readonly setGraph: (graph: PhaseGraph) => void
  readonly dispatch: (action: EngineAction) => Promise<unknown>
  readonly activateView: () => Promise<void>
}

/**
 * Programmatic action to resolve and launch a scheduled cadence routine.
 * Prevents clobbering active sessions via decideStartAction and confirmReplace.
 */
export async function runCadenceRoutine(
  rules: readonly CadenceRule[],
  context: CadenceContext,
  deps: CadenceLauncherDeps,
): Promise<CadenceLaunchResult> {
  const matchedRule = resolveCadenceRoutine(rules, context)
  if (matchedRule === null) {
    return 'no-match'
  }

  const fileContent = await deps.readRoutineFile(matchedRule.routinePath)
  if (fileContent === null) {
    return 'file-not-found'
  }

  const parseResult = parseRoutineFile(fileContent)
  if (!parseResult.success) {
    return 'parse-error'
  }

  const graph = parseResult.graph
  const active = deps.getActiveRoutine()
  const action = decideStartAction(
    { graphId: active.graphId, status: active.status },
    graph.id,
  )

  if (action === 'confirm') {
    const confirmation = await deps.confirmReplace(active.graphName, graph.name)
    if (confirmation !== 'confirmed') {
      return 'cancelled'
    }
  }

  if (active.graphId !== graph.id) {
    deps.setGraph(graph)
  }

  await deps.dispatch({ type: 'start' })
  await deps.activateView()

  return 'started'
}
