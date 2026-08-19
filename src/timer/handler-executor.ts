import { Temporal } from 'temporal-polyfill'
import type { Handler } from '../domain/handler/handler'
import type { Effect } from '../domain/handler/effect'
import type { PhaseNode } from '../domain/phase/phase'
import type { PhaseInstance, Session } from '../domain/session/session'
import type { HookContext, HookRegistry } from '../domain/hook/hook'
import { HookNameSchema } from '../domain/hook/hook-reference'
import type { FrontmatterReader } from '../domain/mutation/frontmatter-reader'
import { TaskQueueItemIdSchema } from '../domain/queue/task-source'

export interface HandlerContext {
  readonly phase: PhaseNode
  readonly instance: PhaseInstance
  readonly session: Session
  readonly activeFilePath: string | null
  readonly now: Temporal.Instant
}

export interface HandlerDeps {
  readonly hookRegistry?: HookRegistry
  readonly frontmatterReader?: FrontmatterReader
}

function resolveFrontmatterValue(val: unknown, fallback: string): string | number | boolean {
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return val
  }
  return fallback
}

export async function executeHandler(
  handler: Handler,
  context: HandlerContext,
  deps: HandlerDeps = {},
): Promise<readonly Effect[]> {
  try {
    if (handler.kind === 'preset') {
      switch (handler.preset) {
        case 'markDone': {
          if (context.activeFilePath === null) {
            return []
          }
          const itemId = TaskQueueItemIdSchema.parse(context.activeFilePath)
          return [{
            kind: 'fileMutation',
            mutations: [{ kind: 'queueStatusChange', itemId, status: 'done' }],
          }]
        }
        case 'queueCycle': {
          if (context.activeFilePath === null) {
            return []
          }
          const itemId = TaskQueueItemIdSchema.parse(context.activeFilePath)
          return [{
            kind: 'fileMutation',
            mutations: [{ kind: 'queueReorder', itemId, position: 'back' }],
          }]
        }
        case 'deferDuration': {
          if (context.activeFilePath === null) {
            return []
          }
          const itemId = TaskQueueItemIdSchema.parse(context.activeFilePath)
          const durationParam = handler.params?.after
          const duration = typeof durationParam === 'string'
            ? Temporal.Duration.from(durationParam)
            : Temporal.Duration.from({ days: 1 })
          const dueIsoString = context.now.toZonedDateTimeISO('UTC').add(duration).toInstant().toString()
          return [{
            kind: 'fileMutation',
            mutations: [
              { kind: 'queueStatusChange', itemId, status: 'deferred' },
              { kind: 'frontmatter', filePath: context.activeFilePath, property: 'routine-due', value: dueIsoString },
            ],
          }]
        }
        case 'setFrontmatter': {
          if (context.activeFilePath === null) {
            return []
          }
          const property = typeof handler.params?.property === 'string' ? handler.params.property : 'routine-due'
          const value = resolveFrontmatterValue(handler.params?.value, context.now.toString())
          return [{
            kind: 'fileMutation',
            mutations: [
              { kind: 'frontmatter', filePath: context.activeFilePath, property, value },
            ],
          }]
        }
        case 'notify': {
          const title = typeof handler.params?.title === 'string' ? handler.params.title : 'Routine Flow'
          const body = typeof handler.params?.body === 'string' ? handler.params.body : `${context.phase.name} finished`
          const system = typeof handler.params?.system === 'boolean' ? handler.params.system : false
          return [{
            kind: 'notification',
            notification: { title, body, system },
          }]
        }
      }
    }

    if (handler.kind === 'script') {
      const { hookRegistry } = deps
      if (hookRegistry === undefined) {
        return []
      }
      const hook = hookRegistry.resolve(HookNameSchema.parse(handler.scriptPath))
      if (hook === undefined) {
        return []
      }
      const hookContext: HookContext = {
        phase: context.phase,
        instance: context.instance,
        session: context.session,
        activeFilePath: context.activeFilePath,
        params: handler.params ?? {},
      }
      const mutations = await hook(hookContext)
      return [{ kind: 'fileMutation', mutations: [...mutations] }]
    }
  }
  catch (cause) {
    return [{ kind: 'invocationFailed', cause }]
  }

  return []
}

export async function executeHandlers(
  handlers: readonly Handler[],
  context: HandlerContext,
  deps: HandlerDeps = {},
): Promise<readonly Effect[]> {
  let effects: readonly Effect[] = []
  for (const handler of handlers) {
    const res = await executeHandler(handler, context, deps)
    effects = [...effects, ...res]
  }
  return effects
}
