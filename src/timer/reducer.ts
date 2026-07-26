import type { Temporal } from 'temporal-polyfill'
import type { EngineState } from '../domain/session/engine-state'
import type { Phase, PhaseId } from '../domain/phase/phase'
import type { PhaseGraph } from '../domain/phase/phase-graph'
import type { HookEvent } from '../domain/hook/hook'
import type { PredicateRegistry } from '../domain/hook/predicate'
import { closePhaseInstance, openPhaseInstance, openSession } from '../domain/session/session'
import type { ItemTouch, PhaseInstanceEndReason, PhaseInstanceId, Session } from '../domain/session/session'
import { findPhaseById, resolveNextPhaseId } from './phase-graph'
import type { EngineDeps } from './engine-deps'

/** Actions dispatched by external callers (ticker, views) via EngineStore.dispatch. */
export type EngineAction
  = | { type: 'start', filePath?: string }
    | { type: 'pause' }
    | { type: 'resume' }
    | { type: 'stop' }
    | { type: 'tick' }
    | { type: 'finish-phase' }
    | { type: 'advance-phase' }
    | { type: 'set-active-file', filePath: string | null }
    | { type: 'set-queue-exhausted', exhausted: boolean }
    /** Store-internal-only, mirroring set-queue-exhausted -- no external caller dispatches this directly. */
    | { type: 'record-item-touch', item: ItemTouch }

/**
 * What engineReducer actually receives. start/tick/finish-phase/advance-phase/stop -- the actions
 * that can open/close a PhaseInstance -- carry `now`, stamped on by EngineStore.dispatch before
 * calling engineReducer (see design.md Decision 1); engineReducer itself never reads Temporal.Now.
 * External dispatch() callers construct plain EngineActions without `now` -- EngineStore fills it
 * in, the same "store resolves external state, reducer reads it back off the action" pattern as
 * set-queue-exhausted/phaseVisitCounts.
 */
export type StampedEngineAction
  = | { type: 'start', filePath?: string, now: Temporal.Instant }
    | { type: 'pause' }
    | { type: 'resume' }
    | { type: 'stop', now: Temporal.Instant }
    | { type: 'tick', now: Temporal.Instant }
    | { type: 'finish-phase', now: Temporal.Instant }
    | { type: 'advance-phase', now: Temporal.Instant }
    | { type: 'set-active-file', filePath: string | null }
    | { type: 'set-queue-exhausted', exhausted: boolean }
    | { type: 'record-item-touch', item: ItemTouch }

/**
 * Build the initial stopped state for a given phase graph, at its first
 * declared phase (the graph's array order is the entry-point convention,
 * same as v1 Workflow).
 */
export function initialEngineState(graph: PhaseGraph): EngineState {
  const startPhase = requirePhaseById(graph, graph.phases[0]?.id)
  return {
    status: 'stopped',
    phaseGraphId: graph.id,
    currentPhaseId: startPhase.id,
    remaining: startPhase.duration,
    activeFilePath: null,
    phaseVisitCounts: {},
    queueExhausted: false,
    session: null,
  }
}

/**
 * Pure reducer for the timer engine. Receives the active PhaseGraph so phase
 * durations, transitions, and progression are fully configurable.
 */
export function engineReducer(
  state: EngineState,
  action: StampedEngineAction,
  graph: PhaseGraph,
  deps: EngineDeps = {},
): EngineState {
  const { predicateRegistry } = deps
  switch (action.type) {
    case 'start': {
      const phase = requirePhaseById(graph, state.currentPhaseId)
      return {
        ...state,
        status: 'running',
        activeFilePath: action.filePath !== undefined ? action.filePath : state.activeFilePath,
        session: state.session ?? openSession(state.phaseGraphId, action.now, phase),
      }
    }
    case 'pause':
      return { ...state, status: 'paused' }
    case 'resume':
      return { ...state, status: 'running' }
    case 'stop':
      return initialEngineState(graph)
    case 'tick':
      if (state.remaining === null) {
        // Duration-less (manual/until-dismissed) phase: nothing to count down.
        return state
      }
      return state.remaining.sign > 0
        ? { ...state, remaining: state.remaining.subtract({ seconds: 1 }) }
        : completePhase(state, graph, predicateRegistry, action.now)
    case 'finish-phase':
      return completePhase(state, graph, predicateRegistry, action.now)
    case 'advance-phase':
      // Clearing an already-'completed' manualClear phase records the instance as having
      // completed naturally (its onComplete already fired) -- 'skipped' otherwise (an override
      // off a running/paused phase, or off 'stopped' before it was ever started this visit).
      return advancePhase(state, graph, predicateRegistry, action.now, state.status === 'completed' ? 'completed' : 'skipped')
    case 'set-active-file':
      return action.filePath === state.activeFilePath
        ? state
        : { ...state, activeFilePath: action.filePath }
    case 'set-queue-exhausted':
      return action.exhausted === state.queueExhausted
        ? state
        : { ...state, queueExhausted: action.exhausted }
    case 'record-item-touch':
      return recordItemTouch(state, action.item)
  }
}

/** One lifecycle hook event observed for a specific phase during a single dispatch. */
export interface HookEventOccurrence {
  readonly event: HookEvent
  readonly phase: Phase
  /** Identifies the exact PhaseInstance this firing belongs to -- a cyclic PhaseGraph revisits the same phaseId repeatedly, so phaseId alone can't disambiguate which visit an occurrence belongs to. */
  readonly phaseInstanceId: PhaseInstanceId
}

/**
 * Derives which onEnter/onComplete/onSkip/onExit events fired for a single
 * dispatch, by observing the pre- and post-reduce EngineState plus the
 * action that produced the transition — engineReducer itself stays
 * hook-unaware. Doesn't duplicate reducer logic, just interprets its output;
 * see design.md for the full derivation-rules table and rationale.
 */
export function deriveHookEvents(
  prevState: EngineState,
  nextState: EngineState,
  action: EngineAction,
  graph: PhaseGraph,
): readonly HookEventOccurrence[] {
  const prevPhase = requirePhaseById(graph, prevState.currentPhaseId)

  // No session ever opened (dispatched before 'start') -- there's no PhaseInstance to attribute a
  // firing to, so no hook events fire. Every currently-wired dispatch site only reaches tick/
  // finish-phase/advance-phase/stop while a session is open; this guards a future caller that
  // doesn't, the same "unresolved external state => don't fire the exceptional branch" precedent
  // as an unresolved 'custom' predicate.
  if (prevState.session === null) {
    return []
  }

  // finish-phase reaches completePhase the same way a zero-remaining tick does, so it derives identically.
  if (action.type === 'tick' || action.type === 'finish-phase') {
    if (nextState.status === 'completed' && prevState.status !== 'completed') {
      return [{ event: 'onComplete', phase: prevPhase, phaseInstanceId: requireCurrentInstanceId(nextState, prevPhase) }]
    }
    if (prevState.currentPhaseId !== nextState.currentPhaseId) {
      const nextPhase = requirePhaseById(graph, nextState.currentPhaseId)
      const closedInstanceId = requireLastClosedInstanceId(nextState, prevPhase)
      return [
        { event: 'onComplete', phase: prevPhase, phaseInstanceId: closedInstanceId },
        { event: 'onExit', phase: prevPhase, phaseInstanceId: closedInstanceId },
        { event: 'onEnter', phase: nextPhase, phaseInstanceId: requireCurrentInstanceId(nextState, nextPhase) },
      ]
    }
    return []
  }

  if (action.type === 'advance-phase') {
    const nextPhase = requirePhaseById(graph, nextState.currentPhaseId)
    const abandoned = prevState.status === 'running' || prevState.status === 'paused'
    const closedInstanceId = requireLastClosedInstanceId(nextState, prevPhase)
    return [
      ...(abandoned ? [{ event: 'onSkip', phase: prevPhase, phaseInstanceId: closedInstanceId } as const] : []),
      { event: 'onExit', phase: prevPhase, phaseInstanceId: closedInstanceId },
      { event: 'onEnter', phase: nextPhase, phaseInstanceId: requireCurrentInstanceId(nextState, nextPhase) },
    ]
  }

  // A 'stop' mid-phase abandons the in-progress instance — onExit fires with 'abandoned', the one
  // PhaseInstanceEndReason no other action path produces (flow-gu1.33). Stopping from 'stopped' or
  // 'completed' has no in-progress instance to abandon, so nothing fires. nextState.session is
  // already null here (stop fully resets EngineState) — the closing instance's id can only be read
  // off prevState, before the reset discarded it; EngineStore.resolveInstance closes it for real.
  if (action.type === 'stop' && (prevState.status === 'running' || prevState.status === 'paused')) {
    return [{ event: 'onExit', phase: prevPhase, phaseInstanceId: requireCurrentInstanceId(prevState, prevPhase) }]
  }

  return []
}

function requireCurrentInstanceId(state: EngineState, phase: Phase): PhaseInstanceId {
  const id = state.session?.currentInstance?.id
  if (id === undefined) {
    throw new Error(`No open PhaseInstance for phase "${phase.id}" -- a session must be started before phase-transition actions can fire hook events.`)
  }
  return id
}

function requireLastClosedInstanceId(state: EngineState, phase: Phase): PhaseInstanceId {
  const id = state.session?.history.at(-1)?.id
  if (id === undefined) {
    throw new Error(`No closed PhaseInstance found for phase "${phase.id}" -- a session must be started before phase-transition actions can fire hook events.`)
  }
  return id
}

/**
 * Natural (tick-driven) completion of the current phase — branches on its
 * completionPolicy. Unlike advancePhase (an explicit override dispatched via
 * the 'advance-phase' action, which always advances regardless of policy),
 * this is only reached when a phase's duration actually elapses.
 */
function completePhase(state: EngineState, graph: PhaseGraph, predicateRegistry: PredicateRegistry | undefined, now: Temporal.Instant): EngineState {
  const phase = requirePhaseById(graph, state.currentPhaseId)
  const policy = phase.completionPolicy
  if (policy === null || policy.kind === 'noOp') {
    return advancePhase(state, graph, predicateRegistry, now, 'completed')
  }
  if (policy.kind === 'manualClear') {
    // The phase stays current (status flips to 'completed') until an explicit advance-phase moves
    // on -- its instance stays open (session.currentInstance unchanged), not closed here.
    return { ...state, status: 'completed' }
  }
  throw new Error(
    `Phase "${phase.id}" has completionPolicy "${policy.kind}", which the engine doesn't execute yet.`,
  )
}

/**
 * Advance out of the current phase, resolving the next phase via the
 * graph's transitions. The timer stops when a phase completes — the UI or
 * host decides whether to auto-start the next one. Closes the outgoing
 * instance (if a session is open) with `endReason`, and opens a new instance
 * for the phase being entered.
 */
function advancePhase(state: EngineState, graph: PhaseGraph, predicateRegistry: PredicateRegistry | undefined, now: Temporal.Instant, endReason: PhaseInstanceEndReason): EngineState {
  const updatedCounts = {
    ...state.phaseVisitCounts,
    [state.currentPhaseId]: (state.phaseVisitCounts[state.currentPhaseId] ?? 0) + 1,
  }
  const nextPhaseId = resolveNextPhaseId(graph, state.currentPhaseId, updatedCounts, predicateRegistry, state.queueExhausted)
  const nextPhase = requirePhaseById(graph, nextPhaseId)
  return {
    ...state,
    status: 'stopped',
    currentPhaseId: nextPhaseId,
    remaining: nextPhase.duration,
    phaseVisitCounts: updatedCounts,
    session: transitionSession(state.session, now, endReason, nextPhase),
  }
}

/** Closes `session.currentInstance` (if any) and opens a fresh one for `nextPhase`. A no-op (stays null) when no session is open. */
function transitionSession(session: Session | null, now: Temporal.Instant, endReason: PhaseInstanceEndReason, nextPhase: Phase): Session | null {
  if (session === null) {
    return null
  }
  return {
    ...session,
    history: session.currentInstance === null
      ? session.history
      : [...session.history, closePhaseInstance(session.currentInstance, now, endReason)],
    currentInstance: openPhaseInstance(nextPhase, now),
  }
}

/** Appends `item` to the open instance's itemsTouched, unless it's already the active (tail) item. A no-op when no session/instance is open. */
function recordItemTouch(state: EngineState, item: ItemTouch): EngineState {
  const instance = state.session?.currentInstance
  if (state.session === null || instance === null || instance === undefined || instance.itemsTouched.at(-1)?.id === item.id) {
    return state
  }
  return {
    ...state,
    session: {
      ...state.session,
      currentInstance: { ...instance, itemsTouched: [...instance.itemsTouched, item] },
    },
  }
}

function requirePhaseById(graph: PhaseGraph, id: PhaseId | undefined) {
  if (id === undefined) {
    throw new Error(`PhaseGraph "${graph.id}" has no phases`)
  }
  const phase = findPhaseById(graph, id)
  if (phase === undefined) {
    throw new Error(`PhaseGraph "${graph.id}" has no phase "${id}"`)
  }
  return phase
}
