import type { FileMutation } from './file-mutation'

export type FrontmatterMutation = Extract<FileMutation, { kind: 'frontmatter' | 'queueReorder' | 'queueStatusChange' }>

/**
 * The seam between a domain-produced FileMutation intent and an actual vault
 * write. One method per closed-union kind rather than a single generic
 * apply(mutation) — keeps each method type-safe against its FileMutation
 * variant and lets a test fake selectively reject one kind.
 */
export interface FileMutationPort {
  writeFrontmatter: (mutation: Extract<FileMutation, { kind: 'frontmatter' }>) => Promise<void>
  appendText: (mutation: Extract<FileMutation, { kind: 'append' }>) => Promise<void>
  reorderQueueItem: (mutation: Extract<FileMutation, { kind: 'queueReorder' }>) => Promise<void>
  changeQueueItemStatus: (mutation: Extract<FileMutation, { kind: 'queueStatusChange' }>) => Promise<void>
  writeFrontmatterBatch?: (filePath: string, mutations: readonly FrontmatterMutation[]) => Promise<void>
}

/** Outcome of `applyMutations`, returning a resolved result object instead of throwing. */
export type ApplyMutationsResult =
  | { readonly success: true }
    /** `appliedCount` is how many leading mutations (by position, not identity) dispatched successfully before `mutation` failed -- lets a caller recover the successful prefix even if `mutations` contains the same FileMutation object more than once. */
  | { readonly success: false, readonly mutation: FileMutation, readonly cause: unknown, readonly appliedCount: number }

const dispatch = (port: FileMutationPort, mutation: FileMutation): Promise<void> =>
  mutation.kind === 'frontmatter'
    ? port.writeFrontmatter(mutation)
    : mutation.kind === 'append'
      ? port.appendText(mutation)
      : mutation.kind === 'queueReorder'
        ? port.reorderQueueItem(mutation)
        : port.changeQueueItemStatus(mutation)

const applyFrom = (
  port: FileMutationPort,
  mutations: readonly FileMutation[],
  appliedCount: number,
): Promise<ApplyMutationsResult> => {
  const [mutation, ...rest] = mutations
  return mutation === undefined
    ? Promise.resolve({ success: true })
    : dispatch(port, mutation).then(
        (_dispatched: void) => applyFrom(port, rest, appliedCount + 1),
        (cause: unknown) => ({ success: false, mutation, cause, appliedCount }),
      )
}

type FileGroup = {
  readonly filePath: string
  readonly mutations: readonly [FrontmatterMutation, ...FrontmatterMutation[]]
}

type ExecutionStep =
  | { readonly kind: 'single', readonly mutation: FileMutation }
  | { readonly kind: 'batch', readonly filePath: string, readonly mutations: readonly [FrontmatterMutation, ...FrontmatterMutation[]] }

const targetFilePath = (mutation: FrontmatterMutation): string =>
  mutation.kind === 'frontmatter' ? mutation.filePath : mutation.itemId

const addToGroups = (
  groups: readonly FileGroup[],
  mutation: FrontmatterMutation,
): readonly FileGroup[] => {
  const filePath = targetFilePath(mutation)
  const existingIndex = groups.findIndex(group => group.filePath === filePath)
  return existingIndex === -1
    ? [...groups, { filePath, mutations: [mutation] }]
    : groups.map((group, index) =>
        index === existingIndex
          ? { filePath: group.filePath, mutations: [...group.mutations, mutation] }
          : group)
}

const flushGroups = (groups: readonly FileGroup[]): readonly ExecutionStep[] =>
  groups.map(group =>
    group.mutations.length === 1
      ? { kind: 'single', mutation: group.mutations[0] }
      : { kind: 'batch', filePath: group.filePath, mutations: group.mutations })

type PlanAccumulator = {
  readonly steps: readonly ExecutionStep[]
  readonly pending: readonly FileGroup[]
}

const planSteps = (mutations: readonly FileMutation[]): readonly ExecutionStep[] => {
  const initial: PlanAccumulator = { steps: [], pending: [] }
  const final = mutations.reduce<PlanAccumulator>(
    (acc, mutation) =>
      mutation.kind === 'append'
        ? {
            steps: [...acc.steps, ...flushGroups(acc.pending), { kind: 'single', mutation }],
            pending: [],
          }
        : {
            steps: acc.steps,
            pending: addToGroups(acc.pending, mutation),
          },
    initial,
  )
  return [...final.steps, ...flushGroups(final.pending)]
}

const applySteps = (
  port: FileMutationPort,
  writeBatch: NonNullable<FileMutationPort['writeFrontmatterBatch']>,
  steps: readonly ExecutionStep[],
  appliedCount: number,
): Promise<ApplyMutationsResult> => {
  const [step, ...rest] = steps
  return step === undefined
    ? Promise.resolve({ success: true })
    : (step.kind === 'single'
        ? dispatch(port, step.mutation)
        : writeBatch(step.filePath, step.mutations)
      ).then(
        (_dispatched: void) => applySteps(port, writeBatch, rest, appliedCount + (step.kind === 'single' ? 1 : step.mutations.length)),
        (cause: unknown) => ({
          success: false,
          mutation: step.kind === 'single' ? step.mutation : step.mutations[0],
          cause,
          appliedCount,
        }),
      )
}

/**
 * Dispatches each mutation to its matching FileMutationPort method,
 * sequentially and in order — real vault writes can target the same file, so
 * ordering must be deterministic and writes must not race. When the port
 * provides `writeFrontmatterBatch`, same-file frontmatter writes within each
 * non-append segment are coalesced into a single batch call. Fails fast: the
 * first rejected port call resolves the whole call with a failure result,
 * leaving any later mutations undispatched.
 */
export const applyMutations = (
  port: FileMutationPort,
  mutations: readonly FileMutation[],
): Promise<ApplyMutationsResult> =>
  port.writeFrontmatterBatch === undefined
    ? applyFrom(port, mutations, 0)
    : applySteps(port, port.writeFrontmatterBatch.bind(port), planSteps(mutations), 0)
