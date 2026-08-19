import { Temporal } from 'temporal-polyfill'
import type { PhaseNode } from '../domain/phase/phase'
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

function resolveTargetFilePath(
  phase: PhaseNode,
  activeFilePath: string | null,
  registry: LogTargetResolverRegistry,
): string | null {
  if (phase.logTarget === null) {
    return null
  }
  if (phase.logTarget.kind === 'activeItem') {
    return activeFilePath
  }
  const resolver = registry.resolve(phase.logTarget.name)
  return resolver === undefined ? null : resolver(phase)
}

/**
 * Builds the write-back Hook.
 */
export function createWriteBackHook(deps: WriteBackHookDeps): Hook {
  return async (context) => {
    const filePath = resolveTargetFilePath(context.phase, context.activeFilePath, deps.logTargetResolverRegistry)
    if (filePath === null) {
      return []
    }
    const property = deps.getWriteBackProperty()
    const currentValue = deps.frontmatterReader.readValue(filePath, property)
    const entry = nextLogEntry(currentValue, property, Temporal.Now.instant())

    const globalConfirm = deps.getConfirmWriteBack === undefined || deps.getConfirmWriteBack()
    const params = context.params ?? {}
    const phaseConfirm = params.prompt !== false && params.confirm !== false && params.skipPrompt !== true
    const shouldPrompt = globalConfirm && phaseConfirm

    if (!shouldPrompt) {
      const mutation: FileMutation = FileMutationSchema.parse({
        kind: 'frontmatter',
        filePath,
        property: entry.property,
        value: entry.value,
      })
      return [mutation]
    }

    const promptResult = await deps.writeBackPrompt.prompt({ filePath, property: entry.property, value: entry.value })
    if (promptResult.kind === 'cancelled') {
      return []
    }
    const mutation: FileMutation = FileMutationSchema.parse({
      kind: 'frontmatter',
      filePath: promptResult.values.filePath,
      property: promptResult.values.property,
      value: promptResult.values.value,
    })
    return [mutation]
  }
}
