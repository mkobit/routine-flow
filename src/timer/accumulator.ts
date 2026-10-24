import type { PhaseNode } from '../domain/phase/phase'
import type { LogTargetResolverRegistry } from '../domain/log-target/log-target-resolver'
import type { FrontmatterReader } from '../domain/mutation/frontmatter-reader'
import { FileMutationSchema } from '../domain/mutation/file-mutation'
import type { FileMutation } from '../domain/mutation/file-mutation'
import type { TaskSourceRegistry } from '../domain/queue/task-source'
import type { Hook, HookContext } from '../domain/hook/hook'
import { HookNameSchema } from '../domain/hook/hook-reference'

/** Name the reward bank accumulator Hook is registered and referenced under. */
export const ACCUMULATOR_HOOK_NAME = HookNameSchema.parse('accumulator')

export interface AccumulatorHookDeps {
  readonly frontmatterReader: FrontmatterReader
  readonly taskSourceRegistry?: TaskSourceRegistry
  readonly getTrackerFilePath?: (context: HookContext) => string | null
  readonly logTargetResolverRegistry?: LogTargetResolverRegistry
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function resolveLogTargetFilePath(
  phase: PhaseNode,
  activeFilePath: string | null,
  registry?: LogTargetResolverRegistry,
): string | null {
  if (phase.logTarget === null) {
    return null
  }
  if (phase.logTarget.kind === 'activeItem') {
    return nonEmptyString(activeFilePath)
  }
  if (phase.logTarget.kind === 'completedItems') {
    return null
  }
  if (registry !== undefined) {
    const resolver = registry.resolve(phase.logTarget.name)
    return resolver === undefined ? null : nonEmptyString(resolver(phase))
  }
  return nonEmptyString(phase.logTarget.name)
}

export function resolveAccumulatorTrackerFilePath(
  context: HookContext,
  deps: AccumulatorHookDeps,
): string | null {
  const params = context.params ?? {}
  const fromParamPath = nonEmptyString(params.trackerFilePath)
  if (fromParamPath !== null) {
    return fromParamPath
  }
  const fromParamFile = nonEmptyString(params.trackerFile)
  if (fromParamFile !== null) {
    return fromParamFile
  }
  if (deps.getTrackerFilePath !== undefined) {
    const fromGetter = nonEmptyString(deps.getTrackerFilePath(context))
    if (fromGetter !== null) {
      return fromGetter
    }
  }
  return resolveLogTargetFilePath(context.phase, context.activeFilePath, deps.logTargetResolverRegistry)
}

function resolveItemProperty(params: Readonly<Record<string, unknown>>): string {
  return nonEmptyString(params.itemProperty)
    ?? nonEmptyString(params.property)
    ?? 'stars'
}

function resolveTrackerProperty(params: Readonly<Record<string, unknown>>): string {
  return nonEmptyString(params.trackerProperty)
    ?? nonEmptyString(params.property)
    ?? 'stars'
}

function readExtraPropertyAmount(
  context: HookContext,
  deps: AccumulatorHookDeps,
  itemProperty: string,
): number | null {
  if (context.phase.taskSourceId === null || deps.taskSourceRegistry === undefined) {
    return null
  }
  const source = deps.taskSourceRegistry.resolve(context.phase.taskSourceId)
  if (source === undefined) {
    return null
  }
  const queue = source.getQueue()
  const activeItem = context.activeFilePath !== null
    ? queue.find(item => item.sourcePath === context.activeFilePath || item.id === context.activeFilePath)
    : queue.find(item => item.cycleStatus === 'active')
  if (activeItem?.extraProperties === undefined) {
    return null
  }
  return toFiniteNumber(activeItem.extraProperties[itemProperty])
}

function readFrontmatterAmount(
  context: HookContext,
  deps: AccumulatorHookDeps,
  trackerFilePath: string,
  itemProperty: string,
  trackerProperty: string,
): number | null {
  if (context.activeFilePath === null) {
    return null
  }
  if (context.activeFilePath === trackerFilePath && itemProperty === trackerProperty) {
    return null
  }
  return toFiniteNumber(deps.frontmatterReader.readValue(context.activeFilePath, itemProperty))
}

function resolveDefaultAmount(params: Readonly<Record<string, unknown>>): number {
  return toFiniteNumber(params.defaultAmount)
    ?? toFiniteNumber(params.amount)
    ?? 1
}

function resolveIncrementAmount(
  context: HookContext,
  deps: AccumulatorHookDeps,
  trackerFilePath: string,
  itemProperty: string,
  trackerProperty: string,
): number {
  const fromExtra = readExtraPropertyAmount(context, deps, itemProperty)
  if (fromExtra !== null) {
    return fromExtra
  }
  const fromFrontmatter = readFrontmatterAmount(context, deps, trackerFilePath, itemProperty, trackerProperty)
  if (fromFrontmatter !== null) {
    return fromFrontmatter
  }
  return resolveDefaultAmount(context.params ?? {})
}

function readCurrentTrackerValue(
  frontmatterReader: FrontmatterReader,
  trackerFilePath: string,
  trackerProperty: string,
): number {
  return toFiniteNumber(frontmatterReader.readValue(trackerFilePath, trackerProperty)) ?? 0
}

/**
 * Builds the reward bank accumulator Hook.
 */
export function createAccumulatorHook(deps: AccumulatorHookDeps): Hook {
  return async (context) => {
    const trackerFilePath = resolveAccumulatorTrackerFilePath(context, deps)
    if (trackerFilePath === null) {
      return []
    }

    const params = context.params ?? {}
    const trackerProperty = resolveTrackerProperty(params)

    if (params.action === 'reset' || params.reset === true) {
      const resetValue = toFiniteNumber(params.resetValue)
        ?? toFiniteNumber(params.value)
        ?? 0
      const mutation: FileMutation = FileMutationSchema.parse({
        kind: 'frontmatter',
        filePath: trackerFilePath,
        property: trackerProperty,
        value: resetValue,
      })
      return [mutation]
    }

    const currentValue = readCurrentTrackerValue(deps.frontmatterReader, trackerFilePath, trackerProperty)

    if (params.action === 'deduct') {
      const deductAmount = toFiniteNumber(params.amount)
        ?? toFiniteNumber(params.defaultAmount)
        ?? 1
      const nextValue = Math.max(0, currentValue - deductAmount)
      const mutation: FileMutation = FileMutationSchema.parse({
        kind: 'frontmatter',
        filePath: trackerFilePath,
        property: trackerProperty,
        value: nextValue,
      })
      return [mutation]
    }

    const itemProperty = resolveItemProperty(params)
    const increment = resolveIncrementAmount(context, deps, trackerFilePath, itemProperty, trackerProperty)
    const nextValue = currentValue + increment

    const mutation: FileMutation = FileMutationSchema.parse({
      kind: 'frontmatter',
      filePath: trackerFilePath,
      property: trackerProperty,
      value: nextValue,
    })
    return [mutation]
  }
}
