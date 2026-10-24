import { Temporal } from 'temporal-polyfill'
import type { PhaseNode } from '../domain/phase/phase'
import type { PhaseInstance } from '../domain/session/session'
import type { LogTargetResolverRegistry } from '../domain/log-target/log-target-resolver'
import type { FrontmatterReader } from '../domain/mutation/frontmatter-reader'
import { nextLogEntry } from '../domain/mutation/log-entry'
import { FileMutationSchema } from '../domain/mutation/file-mutation'
import type { FileMutation } from '../domain/mutation/file-mutation'
import type { WriteBackPromptPort } from '../domain/mutation/write-back-prompt'
import type { Hook } from '../domain/hook/hook'
import { HookNameSchema } from '../domain/hook/hook-reference'

/** Name the write-back Hook is registered and referenced under. */
export const WRITE_BACK_HOOK_NAME = HookNameSchema.parse('write-back')

export interface WriteBackHookDeps {
  readonly logTargetResolverRegistry: LogTargetResolverRegistry
  readonly frontmatterReader: FrontmatterReader
  readonly writeBackPrompt: WriteBackPromptPort
  readonly getWriteBackProperty: () => string
  readonly getConfirmWriteBack?: () => boolean
}

export function resolveTargetFilePaths(
  phase: PhaseNode,
  instance: PhaseInstance | null | undefined,
  activeFilePath: string | null,
  registry: LogTargetResolverRegistry,
): readonly string[] {
  if (phase.logTarget === null) {
    return []
  }
  if (phase.logTarget.kind === 'activeItem') {
    return activeFilePath !== null ? [activeFilePath] : []
  }
  if (phase.logTarget.kind === 'completedItems') {
    if (!instance) {
      return []
    }
    const completed = instance.itemsTouched
      .filter(touch => touch.status === 'completed')
      .map(touch => touch.sourcePath)
    return Array.from(new Set(completed))
  }
  const resolver = registry.resolve(phase.logTarget.name)
  const path = resolver === undefined ? null : resolver(phase)
  return path !== null ? [path] : []
}

export function resolveTargetFilePath(
  phase: PhaseNode,
  activeFilePath: string | null,
  registry: LogTargetResolverRegistry,
): string | null {
  return resolveTargetFilePaths(phase, undefined, activeFilePath, registry)[0] ?? null
}

/**
 * Builds the write-back Hook.
 */
export function createWriteBackHook(deps: WriteBackHookDeps): Hook {
  return async (context) => {
    const targetFilePaths = resolveTargetFilePaths(
      context.phase,
      context.instance,
      context.activeFilePath,
      deps.logTargetResolverRegistry,
    )
    if (targetFilePaths.length === 0) {
      return []
    }
    const property = deps.getWriteBackProperty()
    const globalConfirm = deps.getConfirmWriteBack === undefined || deps.getConfirmWriteBack()
    const params = context.params ?? {}
    const phaseConfirm = params.prompt !== false && params.confirm !== false && params.skipPrompt !== true
    const shouldPrompt = globalConfirm && phaseConfirm

    if (!shouldPrompt) {
      return targetFilePaths.map((filePath) => {
        const currentValue = deps.frontmatterReader.readValue(filePath, property)
        const entry = nextLogEntry(currentValue, property, Temporal.Now.instant())
        return FileMutationSchema.parse({
          kind: 'frontmatter',
          filePath,
          property: entry.property,
          value: entry.value,
        })
      })
    }

    return targetFilePaths.reduce(async (accPromise, filePath) => {
      const acc = await accPromise
      const currentValue = deps.frontmatterReader.readValue(filePath, property)
      const entry = nextLogEntry(currentValue, property, Temporal.Now.instant())
      const promptResult = await deps.writeBackPrompt.prompt({ filePath, property: entry.property, value: entry.value })
      if (promptResult.kind === 'cancelled') {
        return acc
      }
      const mutation: FileMutation = FileMutationSchema.parse({
        kind: 'frontmatter',
        filePath: promptResult.values.filePath,
        property: promptResult.values.property,
        value: promptResult.values.value,
      })
      return [...acc, mutation]
    }, Promise.resolve<readonly FileMutation[]>([]))
  }
}
