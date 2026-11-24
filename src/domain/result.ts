/**
 * Generic success/failure outcome, mirroring zod's safeParse convention: a
 * resolved value instead of a thrown exception. For a step's own
 * domain-meaningful success payload (e.g. RoutineParseResult's `graph`,
 * ApplyMutationsResult's failure-only `mutation`/`cause`), keep a bespoke
 * type instead — this is for internal chains that don't need one.
 */
export type Result<T, E> =
  | { readonly success: true, readonly value: T }
  | { readonly success: false, readonly error: E }

/** Transforms a success value; a failure passes through untouched and fn is not called. */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.success ? { success: true, value: fn(result.value) } : result
}

/** Chains into another Result-returning step; a failure passes through untouched and fn is not called. */
export function andThen<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  return result.success ? fn(result.value) : result
}
