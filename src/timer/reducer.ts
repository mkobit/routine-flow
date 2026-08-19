import type { Temporal } from 'temporal-polyfill'
import type { EngineState } from '../domain/session/engine-state'
import type { PhaseNode, PhaseId } from '../domain/phase/phase'
import type { PhaseGraph } from '../domain/phase/phase-graph'
import type { HookEvent, HookInvocationOutcome } from '../domain/hook/hook'
import type { PredicateRegistry } from '../domain/hook/predicate'
import type { FileMutation } from '../domain/mutation/file-mutation'
import { closePhaseInstance, openPhaseInstance, openSession } from '../domain/session/session'
import type { ItemTouch, PhaseInstance, PhaseInstanceEndReason, PhaseInstanceHookFailure, PhaseInstanceId, Session } from '../domain/session/session'
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
    | { type: 'record-item-touch', item: ItemTouch }
    | { type: 'record-hook-outcome', phaseInstanceId: PhaseInstanceId, event: HookEvent, outcome: HookInvocationOutcome }

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
    | { type: 'record-hook-outcome', phaseInstanceId: PhaseInstanceId, event: HookEvent, outcome: HookInvocationOutcome }

/**
 * Build the initial stopped state for a given phase graph.
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
 * Pure reducer for the timer engine.
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
        return state
      }
      return state.remaining.sign > 0
        ? { ...state, remaining: state.remaining.subtract({ seconds: 1 }) }
        : completePhase(state, graph, predicateRegistry, action.now)
    case 'finish-phase':
      return completePhase(state, graph, predicateRegistry, action.now)
    case 'advance-phase':
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
    case 'record-hook-outcome':
      return recordHookOutcome(state, action.phaseInstanceId, action.event, action.outcome)
  }
}

/** One lifecycle hook event observed for a specific phase during a single dispatch. */
export interface HookEventOccurrence {
  readonly event: HookEvent
  readonly phase: PhaseNode
  readonly phaseInstanceId: PhaseInstanceId
}

/**
 * Derives which onEnter/onComplete/onSkip/onExit events fired for a single dispatch.
 */
export function deriveHookEvents(
  prevState: EngineState,
  nextState: EngineState,
  action: EngineAction,
  graph: PhaseGraph,
): readonly HookEventOccurrence[] {
  const prevPhase = requirePhaseById(graph, prevState.currentPhaseId)

  if (prevState.session === null) {
    return []
  }

  if (action.type === 'tick' || action.type === 'finish-phase') {
    if (nextState.status === 'completed' && prevState.status !== 'completed') {
      return [{ event: 'onComplete', phase: prevPhase, phaseInstanceId: requireCurrentInstanceId(nextState, prevPhase) }]
    }
    if (nextState.status === 'ended') {
      const closedInstanceId = requireLastClosedInstanceId(nextState, prevPhase)
      return [
        { event: 'onComplete', phase: prevPhase, phaseInstanceId: closedInstanceId },
        { event: 'onExit', phase: prevPhase, phaseInstanceId: closedInstanceId },
      ]
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
    if (nextState.status === 'ended') {
      const abandoned = prevState.status === 'running' || prevState.status === 'paused'
      const closedInstanceId = requireLastClosedInstanceId(nextState, prevPhase)
      return [
        ...(abandoned ? [{ event: 'onSkip', phase: prevPhase, phaseInstanceId: closedInstanceId } as const] : []),
        { event: 'onExit', phase: prevPhase, phaseInstanceId: closedInstanceId },
      ]
    }
    const nextPhase = requirePhaseById(graph, nextState.currentPhaseId)
    const abandoned = prevState.status === 'running' || prevState.status === 'paused'
    const closedInstanceId = requireLastClosedInstanceId(nextState, prevPhase)
    return [
      ...(abandoned ? [{ event: 'onSkip', phase: prevPhase, phaseInstanceId: closedInstanceId } as const] : []),
      { event: 'onExit', phase: prevPhase, phaseInstanceId: closedInstanceId },
      { event: 'onEnter', phase: nextPhase, phaseInstanceId: requireCurrentInstanceId(nextState, nextPhase) },
    ]
  }

  if (action.type === 'stop' && (prevState.status === 'running' || prevState.status === 'paused')) {
    return [{ event: 'onExit', phase: prevPhase, phaseInstanceId: requireCurrentInstanceId(prevState, prevPhase) }]
  }

  return []
}

function requireCurrentInstanceId(state: EngineState, phase: PhaseNode): PhaseInstanceId {
  const id = state.session?.currentInstance?.id
  if (id === undefined) {
    throw new Error(`No open PhaseInstance for phase "${phase.id}"`)
  }
  return id
}

function requireLastClosedInstanceId(state: EngineState, phase: PhaseNode): PhaseInstanceId {
  const id = state.session?.history.at(-1)?.id
  if (id === undefined) {
    throw new Error(`No closed PhaseInstance found for phase "${phase.id}"`)
  }
  return id
}

function completePhase(state: EngineState, graph: PhaseGraph, predicateRegistry: PredicateRegistry | undefined, now: Temporal.Instant): EngineState {
  const phase = requirePhaseById(graph, state.currentPhaseId)
  if (phase.onCompletion === 'waitForManual') {
    return { ...state, status: 'completed' }
  }
  return advancePhase(state, graph, predicateRegistry, now, 'completed')
}

function advancePhase(
  state: EngineState,
  graph: PhaseGraph,
  predicateRegistry: PredicateRegistry | undefined,
  now: Temporal.Instant,
  endReason: PhaseInstanceEndReason,
): EngineState {
  const updatedCounts = {
    ...state.phaseVisitCounts,
    [state.currentPhaseId]: (state.phaseVisitCounts[state.currentPhaseId] ?? 0) + 1,
  }
  const nextPhaseId = resolveNextPhaseId(graph, state.currentPhaseId, updatedCounts, predicateRegistry, state.queueExhausted)

  if (nextPhaseId === null) {
    return {
      ...state,
      status: 'ended',
      remaining: null,
      phaseVisitCounts: updatedCounts,
      session: closeSessionOnEnd(state.session, now, endReason),
    }
  }

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

function closeSessionOnEnd(session: Session | null, now: Temporal.Instant, endReason: PhaseInstanceEndReason): Session | null {
  if (session === null) {
    return null
  }
  return {
    ...session,
    endedAt: now,
    currentInstance: null,
    history: session.currentInstance === null
      ? session.history
      : [...session.history, closePhaseInstance(session.currentInstance, now, endReason)],
  }
}

function transitionSession(session: Session | null, now: Temporal.Instant, endReason: PhaseInstanceEndReason, nextPhase: PhaseNode): Session | null {
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

function outcomeDelta(event: HookEvent, outcome: HookInvocationOutcome): { readonly mutations: readonly FileMutation[], readonly failure: PhaseInstanceHookFailure | null } {
  if (outcome.stage === 'invocationFailed') {
    return { mutations: [], failure: { event, kind: 'invocationFailed', cause: outcome.cause } }
  }
  if (outcome.result.success) {
    return { mutations: outcome.mutations, failure: null }
  }
  return {
    mutations: outcome.mutations.slice(0, outcome.result.appliedCount),
    failure: { event, kind: 'mutationFailed', mutation: outcome.result.mutation, cause: outcome.result.cause },
  }
}

function recordHookOutcome(state: EngineState, phaseInstanceId: PhaseInstanceId, event: HookEvent, outcome: HookInvocationOutcome): EngineState {
  const session = state.session
  if (session === null) {
    return state
  }
  const { mutations, failure } = outcomeDelta(event, outcome)
  if (mutations.length === 0 && failure === null) {
    return state
  }
  const foldInstance = (instance: PhaseInstance): PhaseInstance => ({
    ...instance,
    mutationsApplied: [...instance.mutationsApplied, ...mutations],
    hookFailures: failure === null ? instance.hookFailures : [...instance.hookFailures, failure],
  })
  if (session.currentInstance?.id === phaseInstanceId) {
    return { ...state, session: { ...session, currentInstance: foldInstance(session.currentInstance) } }
  }
  const historyIndex = session.history.findIndex(instance => instance.id === phaseInstanceId)
  if (historyIndex === -1) {
    return state
  }
  return {
    ...state,
    session: {
      ...session,
      history: session.history.map((instance, index) => index === historyIndex ? foldInstance(instance) : instance),
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
