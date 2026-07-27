import type { FileMutation } from './file-mutation'

/**
 * The seam between a domain-produced FileMutation intent and an actual vault
 * write. One method per closed-union kind rather than a single generic
 * apply(mutation) — keeps each method type-safe against its FileMutation
 * variant and lets a test fake selectively reject one kind. A real
 * Obsidian-backed implementation is deferred to later integration work.
 */
export interface FileMutationPort {
  writeFrontmatter: (mutation: Extract<FileMutation, { kind: 'frontmatter' }>) => Promise<void>
  appendText: (mutation: Extract<FileMutation, { kind: 'append' }>) => Promise<void>
  reorderQueueItem: (mutation: Extract<FileMutation, { kind: 'queueReorder' }>) => Promise<void>
  changeQueueItemStatus: (mutation: Extract<FileMutation, { kind: 'queueStatusChange' }>) => Promise<void>
}

/**
 * Outcome of applyMutations. Mirrors zod's safeParse convention (a resolved
 * result object rather than a thrown/rejected error) — this domain module is
 * held to the strict functional-style lint rules (no throw, no classes, no
 * Promise.reject), unlike src/timer/** which the Obsidian API exempts.
 */
export type ApplyMutationsResult
  = | { readonly success: true }
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

/**
 * Dispatches each mutation to its matching FileMutationPort method,
 * sequentially and in order — real vault writes can target the same file, so
 * ordering must be deterministic and writes must not race. Fails fast: the
 * first rejected port call resolves the whole call with a failure result,
 * leaving any later mutations undispatched.
 */
export const applyMutations = (
  port: FileMutationPort,
  mutations: readonly FileMutation[],
): Promise<ApplyMutationsResult> => applyFrom(port, mutations, 0)
