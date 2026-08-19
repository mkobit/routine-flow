import { Temporal } from 'temporal-polyfill'
import { deriveHookEvents, engineReducer, initialEngineState } from './reducer'
import type { EngineAction, StampedEngineAction } from './reducer'
import type { EngineState } from '../domain/session/engine-state'
import type { PhaseGraph } from '../domain/phase/phase-graph'
import type { PhaseNode } from '../domain/phase/phase'
import { closePhaseInstance } from '../domain/session/session'
import type { PhaseInstance, PhaseInstanceId, Session } from '../domain/session/session'
import type { HookEvent, HookInvocationOutcome } from '../domain/hook/hook'
import { applyMutations } from '../domain/mutation/apply-mutations'
import type { ApplyMutationsResult } from '../domain/mutation/apply-mutations'
import { deriveActionMutations } from '../domain/action/derive-action-mutations'
import type { QueueItemAction } from '../domain/action/queue-item-action'
import type { EngineDeps } from './engine-deps'
import { findPhaseById } from './phase-graph'
import { executeHandlers } from './handler-executor'
import type { HandlerContext } from './handler-executor'

/** Result of resolving, invoking, and applying one fired handler's mutations. */
export interface HookEventApplication {
  readonly event: HookEvent
  readonly phase: PhaseNode
  readonly outcome: HookInvocationOutcome
}

/** Stamps `now` onto the instance-boundary action variants. */
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

function resolveSession(prevState: EngineState, nextState: EngineState, now: Temporal.Instant): Session {
  if (nextState.session !== null) {
    return nextState.session
  }
  if (prevState.session === null) {
    throw new Error('No Session open while a handler event fired.')
  }
  return { ...prevState.session, endedAt: now }
}

/**
 * Holds the current EngineState and routes dispatched actions through the pure reducer.
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

  public dispatch(action: EngineAction): Promise<readonly HookEventApplication[]> {
    const result = this.pendingDispatch.then(() => this.runDispatch(action))
    this.pendingDispatch = result.then(() => undefined, () => undefined)
    return result
  }

  public async executeAction(action: QueueItemAction, targetPath?: string): Promise<ApplyMutationsResult | null> {
    const { port } = this.deps
    const filePath = targetPath ?? this.state.activeFilePath
    if (port === undefined || filePath === null) {
      return null
    }
    const mutations = deriveActionMutations(action, filePath, Temporal.Now.instant())
    if (mutations.length === 0) {
      return null
    }
    return applyMutations(port, mutations)
  }

  private async runDispatch(action: EngineAction): Promise<readonly HookEventApplication[]> {
    this.syncQueueExhausted()

    const now = Temporal.Now.instant()
    const stamped = stampNow(action, now)
    const prevState = this.state
    const nextState = engineReducer(prevState, stamped, this.graph, this.deps)
    this.applyState(nextState)
    this.syncItemTouch()

    const { hookRegistry, port, notificationPort } = this.deps

    if (notificationPort !== undefined && prevState.currentPhaseId !== nextState.currentPhaseId && nextState.status !== 'ended') {
      const newPhase = findPhaseById(this.graph, nextState.currentPhaseId)
      if (newPhase !== undefined) {
        notificationPort.notifyInApp(`Routine Flow: ${newPhase.name} phase started`)
        if (newPhase.notification?.systemNotification === true) {
          notificationPort.notifySystem('Routine Flow', `${newPhase.name} phase started`)
        }
      }
    }

    let applications: readonly HookEventApplication[] = []
    for (const { event, phase, phaseInstanceId } of deriveHookEvents(prevState, this.state, action, this.graph)) {
      const handlers = phase.handlers[event] ?? []
      if (handlers.length === 0) {
        continue
      }
      const instance = resolveInstance(prevState, this.state, phaseInstanceId, now)
      const session = resolveSession(prevState, this.state, now)
      const handlerContext: HandlerContext = {
        phase,
        instance,
        session,
        activeFilePath: this.state.activeFilePath,
        now,
      }

      const effects = await executeHandlers(handlers, handlerContext, {
        hookRegistry,
      })

      for (const effect of effects) {
        if (effect.kind === 'fileMutation' && port !== undefined) {
          const result = await applyMutations(port, effect.mutations)
          const outcome: HookInvocationOutcome = { stage: 'applied', mutations: effect.mutations, result }
          this.applyState(engineReducer(this.state, { type: 'record-hook-outcome', phaseInstanceId, event, outcome }, this.graph, this.deps))
          applications = [...applications, { event, phase, outcome }]
        }
        else if (effect.kind === 'invocationFailed') {
          const outcome: HookInvocationOutcome = { stage: 'invocationFailed', cause: effect.cause }
          this.applyState(engineReducer(this.state, { type: 'record-hook-outcome', phaseInstanceId, event, outcome }, this.graph, this.deps))
          applications = [...applications, { event, phase, outcome }]
        }
        else if (effect.kind === 'notification' && notificationPort !== undefined) {
          notificationPort.notifyInApp(effect.notification.body ?? `${phase.name} phase event`)
          if (effect.notification.system) {
            notificationPort.notifySystem(effect.notification.title ?? 'Routine Flow', effect.notification.body ?? `${phase.name} phase event`)
          }
        }
      }
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
