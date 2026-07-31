import { Temporal } from 'temporal-polyfill'
import { deriveHookEvents, engineReducer, initialEngineState } from './reducer'
import type { EngineAction, StampedEngineAction } from './reducer'
import type { EngineState } from '../domain/session/engine-state'
import type { PhaseGraph } from '../domain/phase/phase-graph'
import type { Phase } from '../domain/phase/phase'
import { closePhaseInstance } from '../domain/session/session'
import type { PhaseInstance, PhaseInstanceId, Session } from '../domain/session/session'
import type { Hook, HookContext, HookEvent, HookInvocationOutcome } from '../domain/hook/hook'
import type { HookReference } from '../domain/hook/hook-reference'
import { applyMutations } from '../domain/mutation/apply-mutations'
import type { FileMutationPort } from '../domain/mutation/apply-mutations'
import type { EngineDeps } from './engine-deps'
import { findPhaseById } from './phase-graph'

/** Result of resolving, invoking, and applying one fired hook event's mutations. */
export interface HookEventApplication {
  readonly event: HookEvent
  readonly phase: Phase
  readonly outcome: HookInvocationOutcome
}

/**
 * Invokes one resolved hook and applies its mutations, catching an
 * invocation-level throw/rejection so it can't propagate out of
 * EngineStore.dispatch and abort later hook events in the same dispatch —
 * user-authored (e.g. script-backed) hooks throw/hang far more often than
 * the one vetted hand-typed hook this isolation was previously untested
 * against.
 */
async function invokeHook(hook: Hook, port: FileMutationPort, context: HookContext): Promise<HookInvocationOutcome> {
  try {
    const mutations = await hook(context)
    const result = await applyMutations(port, mutations)
    return { stage: 'applied', mutations, result }
  }
  catch (cause) {
    return { stage: 'invocationFailed', cause }
  }
}

function hookReferenceFor(phase: Phase, event: HookEvent): HookReference | null {
  switch (event) {
    case 'onEnter': return phase.onEnter
    case 'onComplete': return phase.onComplete
    case 'onSkip': return phase.onSkip
    case 'onExit': return phase.onExit
  }
}

/** Stamps `now` onto the instance-boundary action variants; other actions pass through unchanged (see reducer.ts's StampedEngineAction doc comment). */
function stampNow(action: EngineAction, now: Temporal.Instant): StampedEngineAction {
  switch (action.type) {
    case 'start':
    case 'tick':
    case 'finish-phase':
    case 'advance-phase':
    case 'stop':
      return { ...action, now }
    default:
      return action
  }
}

/**
 * Resolves the PhaseInstance a fired event's phaseInstanceId refers to, reading real
 * EngineState-tracked history rather than fabricating one (see design.md Decision 9). Checks the
 * just-opened currentInstance, then nextState's closed history -- both cover every case except a
 * 'stop' mid-phase, where the whole session (including the closing instance) is discarded by the
 * same transition that abandons it; nextState.session is null there, so the abandoned instance is
 * closed here instead, from prevState, the only place it's still readable.
 */
function resolveInstance(prevState: EngineState, nextState: EngineState, phaseInstanceId: PhaseInstanceId, now: Temporal.Instant): PhaseInstance {
  if (nextState.session?.currentInstance?.id === phaseInstanceId) {
    return nextState.session.currentInstance
  }
  const closed = nextState.session?.history.find(instance => instance.id === phaseInstanceId)
  if (closed !== undefined) {
    return closed
  }
  const abandoning = prevState.session?.currentInstance
  if (abandoning !== null && abandoning !== undefined && abandoning.id === phaseInstanceId) {
    return closePhaseInstance(abandoning, now, 'abandoned')
  }
  throw new Error(`No PhaseInstance found for id "${phaseInstanceId}"`)
}

/**
 * The Session a fired event belongs to -- nextState's, unless 'stop' already reset it to null (see
 * resolveInstance), in which case prevState's, with `endedAt` stamped here since the reducer never
 * gets a chance to before the whole Session is discarded.
 */
function resolveSession(prevState: EngineState, nextState: EngineState, now: Temporal.Instant): Session {
  if (nextState.session !== null) {
    return nextState.session
  }
  if (prevState.session === null) {
    throw new Error('No Session open while a hook event fired -- a session must be started before phase-transition actions can fire hooks.')
  }
  return { ...prevState.session, endedAt: now }
}

/**
 * Holds the current EngineState and routes dispatched actions through the
 * pure reducer. Notifies subscribers after each state transition.
 * Accepts a PhaseGraph via dependency injection — no hardcoded phase semantics.
 *
 * Optionally takes an EngineDeps bag. Supplying both hookRegistry and port
 * makes dispatch resolve and fire onEnter/onComplete/onSkip/onExit hooks
 * after each transition and apply their FileMutations; omitting either
 * makes hook firing a no-op — existing/test construction sites don't need
 * to supply fakes they don't care about. Omitting predicateRegistry treats
 * every 'custom' TransitionCondition as unsatisfied, rather than requiring
 * a fake for graphs that don't use one. Supplying taskSourceRegistry makes
 * dispatch snapshot the current phase's queue-empty state into
 * state.queueExhausted before evaluating the dispatched action, so a
 * 'queueExhausted' TransitionCondition reads a fresh value at the moment a
 * transition is resolved; omitting it leaves queueExhausted permanently
 * false (same "unresolved => unsatisfied" precedent as predicateRegistry).
 * It also makes dispatch snapshot the active item's lightweight data into
 * the open PhaseInstance's itemsTouched whenever activeFilePath resolves to
 * a new queue item.
 */
export class EngineStore {
  private state: EngineState
  private graph: PhaseGraph
  private listeners: ((state: EngineState) => void)[] = []
  private readonly deps: EngineDeps
  private pendingDispatch: Promise<unknown> = Promise.resolve()

  constructor(graph: PhaseGraph, deps: EngineDeps = {}) {
    this.graph = graph
    this.state = initialEngineState(graph)
    this.deps = deps
  }

  public getState(): EngineState {
    return this.state
  }

  public subscribe(listener: (state: EngineState) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  /**
   * Chains onto a private pending-promise so a call's reducer-apply-hooks
   * sequence fully completes (including any awaited hook) before the next
   * queued call starts its own reducer against this.state -- every real
   * call site fires dispatch fire-and-forget (ticker tick, button click),
   * so overlapping calls are the norm, not an edge case. Swallowing the
   * chained promise's rejection keeps the queue from wedging permanently
   * after one failed call; the original rejection still propagates to this
   * call's own caller via the returned promise.
   */
  public dispatch(action: EngineAction): Promise<readonly HookEventApplication[]> {
    const result = this.pendingDispatch.then(() => this.runDispatch(action))
    this.pendingDispatch = result.then(() => undefined, () => undefined)
    return result
  }

  private async runDispatch(action: EngineAction): Promise<readonly HookEventApplication[]> {
    this.syncQueueExhausted()

    const now = Temporal.Now.instant()
    const stamped = stampNow(action, now)
    const prevState = this.state
    const nextState = engineReducer(prevState, stamped, this.graph, this.deps)
    this.applyState(nextState)
    this.syncItemTouch()

    const { hookRegistry, port } = this.deps
    if (hookRegistry === undefined || port === undefined) {
      return []
    }

    let applications: readonly HookEventApplication[] = []
    for (const { event, phase, phaseInstanceId } of deriveHookEvents(prevState, this.state, action, this.graph)) {
      const reference = hookReferenceFor(phase, event)
      if (reference === null) {
        continue
      }
      const hook = hookRegistry.resolve(reference.name)
      if (hook === undefined) {
        continue
      }
      const context: HookContext = {
        phase,
        instance: resolveInstance(prevState, this.state, phaseInstanceId, now),
        session: resolveSession(prevState, this.state, now),
        activeFilePath: this.state.activeFilePath,
        params: reference.params,
      }
      const outcome = await invokeHook(hook, port, context)
      this.applyState(engineReducer(this.state, { type: 'record-hook-outcome', phaseInstanceId, event, outcome }, this.graph, this.deps))
      applications = [...applications, { event, phase, outcome }]
    }
    return applications
  }

  private applyState(nextState: EngineState): void {
    if (nextState !== this.state) {
      this.state = nextState
      for (const listener of this.listeners) {
        listener(this.state)
      }
    }
  }

  /**
   * Snapshots the current phase's queue-empty state into state.queueExhausted, so a
   * 'queueExhausted' TransitionCondition evaluated later in this same dispatch (via
   * advancePhase -> resolveNextPhaseId) reads a value synced to right now, rather than
   * whatever was last set by a prior dispatch. A no-op when taskSourceRegistry isn't supplied;
   * reads back as "not exhausted" when the current phase has no taskSourceId, or its TaskSource
   * isn't registered yet — same "unknown => don't fire the exceptional branch" precedent as
   * an unresolved 'custom' predicate.
   */
  private syncQueueExhausted(): void {
    const { taskSourceRegistry } = this.deps
    if (taskSourceRegistry === undefined) {
      return
    }
    const phase = findPhaseById(this.graph, this.state.currentPhaseId)
    const source = phase !== undefined && phase.taskSourceId !== null ? taskSourceRegistry.resolve(phase.taskSourceId) : undefined
    const exhausted = source !== undefined && source.getQueue().length === 0
    this.applyState(engineReducer(this.state, { type: 'set-queue-exhausted', exhausted }, this.graph, this.deps))
  }

  /**
   * Snapshots the active item's lightweight data (id/sourcePath/displayName) into the open
   * PhaseInstance's itemsTouched, mirroring syncQueueExhausted's "store resolves external state,
   * feeds it back via the reducer" pattern. A no-op when taskSourceRegistry isn't supplied, no
   * session/instance is open, activeFilePath doesn't resolve to a queue item, or that item is
   * already the instance's active (tail) item -- engineReducer's own record-item-touch case
   * de-duplicates on that last case too.
   */
  private syncItemTouch(): void {
    const { taskSourceRegistry } = this.deps
    const currentInstance = this.state.session?.currentInstance
    if (taskSourceRegistry === undefined || this.state.activeFilePath === null || currentInstance === null || currentInstance === undefined) {
      return
    }
    const phase = findPhaseById(this.graph, this.state.currentPhaseId)
    const source = phase !== undefined && phase.taskSourceId !== null ? taskSourceRegistry.resolve(phase.taskSourceId) : undefined
    const item = source?.getQueue().find(candidate => candidate.sourcePath === this.state.activeFilePath)
    if (item === undefined) {
      return
    }
    this.applyState(engineReducer(this.state, {
      type: 'record-item-touch',
      item: { id: item.id, sourcePath: item.sourcePath, displayName: item.displayName },
    }, this.graph, this.deps))
  }

  /**
   * Switch to a different phase graph and reset to its initial state.
   * Unconditional and immediate: resets even if a session is currently
   * running or paused, discarding its progress with no warning. This store
   * enforces no guard against that — callers that let a user trigger this
   * (e.g. RoutineTimerView's Start handler) must confirm with the user
   * first whenever a different routine is already in progress.
   */
  public setGraph(graph: PhaseGraph) {
    this.graph = graph
    this.state = initialEngineState(graph)
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  public getGraph(): PhaseGraph {
    return this.graph
  }
}
