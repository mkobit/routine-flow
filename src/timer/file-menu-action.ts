import type { PhaseGraph } from '../domain/phase/phase-graph'
import type { EngineState } from '../domain/session/engine-state'
import { parseRoutineFile } from '../domain/routine/routine-file'
import { DEFAULT_PHASE_GRAPH } from './phase-graph-query'

export type FileMenuActionKind = 'focus' | 'start'

export interface FileMenuRoutineCandidate {
  readonly path: string
  readonly label: string
}

export interface FileMenuExecutionDeps {
  readonly getStatus: () => EngineState['status']
  readonly clearActiveViewStatusConfig: () => void
  readonly setGraph: (graph: PhaseGraph) => void
  readonly dispatchStart: (filePath: string) => Promise<unknown>
  readonly activateView: () => Promise<void>
  readonly readRoutineFile: (path: string) => Promise<string>
  readonly showNotice: (message: string) => void
}

/**
 * Decides whether a task file's context menu should focus the active routine
 * or start a new routine.
 */
export function decideFileMenuAction(status: EngineState['status']): FileMenuActionKind {
  return status === 'running' || status === 'paused' ? 'focus' : 'start'
}

/**
 * Focuses `filePath` in the currently running or paused routine without resetting
 * the active view's status config.
 */
export async function focusTaskInActiveRoutine(
  filePath: string,
  deps: Pick<FileMenuExecutionDeps, 'dispatchStart' | 'activateView'>,
): Promise<void> {
  await deps.dispatchStart(filePath)
  await deps.activateView()
}

/**
 * Starts a routine for `filePath` using either the built-in default graph or
 * a selected `is-routine: true` definition file.
 */
export async function startRoutineForTask(
  filePath: string,
  routineFile: FileMenuRoutineCandidate | null,
  deps: Omit<FileMenuExecutionDeps, 'getStatus'>,
): Promise<boolean> {
  if (routineFile === null) {
    deps.clearActiveViewStatusConfig()
    deps.setGraph(DEFAULT_PHASE_GRAPH)
    await deps.dispatchStart(filePath)
    await deps.activateView()
    return true
  }

  const content = await deps.readRoutineFile(routineFile.path)
  const parsed = parseRoutineFile(content)
  if (!parsed.success) {
    deps.showNotice(`Routine Flow: failed to parse routine file "${routineFile.label}" — ${parsed.error.message}`)
    return false
  }

  deps.clearActiveViewStatusConfig()
  deps.setGraph(parsed.graph)
  await deps.dispatchStart(filePath)
  await deps.activateView()
  return true
}
