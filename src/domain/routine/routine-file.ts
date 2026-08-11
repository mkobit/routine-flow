import { Temporal } from 'temporal-polyfill'
import { PhaseGraphSchema, checkPhaseGraphIntegrity } from '../phase/phase-graph'
import type { PhaseGraph } from '../phase/phase-graph'
import { map, andThen } from '../result'
import type { Result } from '../result'

/**
 * Why a routine file's JSON block failed to become a PhaseGraph. `issues` is
 * only populated for schema-validation failures (mirrors ZodIssue's
 * path/message, decoupled from zod's own type so callers don't need it).
 */
export interface RoutineParseError {
  readonly message: string
  readonly issues?: readonly RoutineParseIssue[]
}

export interface RoutineParseIssue {
  readonly path: readonly PropertyKey[]
  readonly message: string
}

/** Mirrors ApplyMutationsResult's resolved-result convention — never a thrown exception. */
export type RoutineParseResult
  = | { readonly success: true, readonly graph: PhaseGraph }
    | { readonly success: false, readonly error: RoutineParseError }

type JsonParseResult
  = | { readonly success: true, readonly value: unknown }
    | { readonly success: false }

const FENCED_JSON_BLOCK = /```json[ \t]*\r?\n([\s\S]*?)\r?\n?```/gi

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function tryParseDuration(iso: string): Temporal.Duration | null {
  try {
    return Temporal.Duration.from(iso)
  }
  catch {
    return null
  }
}

function tryParseJson(text: string): JsonParseResult {
  try {
    return { success: true, value: JSON.parse(text) }
  }
  catch {
    return { success: false }
  }
}

function extractJsonBlock(content: string): Result<string, RoutineParseError> {
  const matches = [...content.matchAll(FENCED_JSON_BLOCK)]
  return matches.length === 1
    ? { success: true, value: matches[0]?.[1] ?? '' }
    : {
        success: false,
        error: {
          message: matches.length === 0
            ? 'Routine file has no fenced JSON code block (```json ... ```).'
            : `Routine file has ${matches.length} fenced JSON code blocks; exactly one is required.`,
        },
      }
}

function convertDurationString(iso: string): Result<unknown, RoutineParseError> {
  const duration = tryParseDuration(iso)
  return duration === null
    ? { success: false, error: { message: `Invalid ISO 8601 duration: "${iso}"` } }
    : { success: true, value: duration }
}

/** Leaves non-string values untouched — schema validation rejects the wrong shape on its own. */
function convertDurationField(value: unknown): Result<unknown, RoutineParseError> {
  return typeof value !== 'string'
    ? { success: true, value }
    : convertDurationString(value)
}

function convertFutureDatePolicy(policy: Record<string, unknown>): Result<unknown, RoutineParseError> {
  return map(convertDurationField(policy.after), after => ({ ...policy, after }))
}

/** Only `{ kind: 'futureDate', after: <ISO string> }` carries a duration field to convert. */
function convertCompletionPolicy(value: unknown): Result<unknown, RoutineParseError> {
  return !isRecord(value) || value.kind !== 'futureDate'
    ? { success: true, value }
    : convertFutureDatePolicy(value)
}

function convertActionPayload(payload: unknown): Result<unknown, RoutineParseError> {
  return !isRecord(payload) || payload.kind !== 'deferDuration'
    ? { success: true, value: payload }
    : map(convertDurationField(payload.after), after => ({ ...payload, after }))
}

function convertAction(action: unknown): Result<unknown, RoutineParseError> {
  return !isRecord(action)
    ? { success: true, value: action }
    : map(convertActionPayload(action.payload), payload => ({ ...action, payload }))
}

function convertActions(actions: unknown): Result<unknown, RoutineParseError> {
  return !Array.isArray(actions)
    ? { success: true, value: actions }
    : actions.reduce<Result<readonly unknown[], RoutineParseError>>(
        (acc, action) => andThen(acc, converted => map(convertAction(action), value => [...converted, value])),
        { success: true, value: [] },
      )
}

function mergePhaseFields(
  phase: Record<string, unknown>,
  durationResult: Result<unknown, RoutineParseError>,
  policyResult: Result<unknown, RoutineParseError>,
  actionsResult: Result<unknown, RoutineParseError>,
): Result<unknown, RoutineParseError> {
  return andThen(durationResult, duration =>
    andThen(policyResult, completionPolicy =>
      map(actionsResult, actions => ({ ...phase, duration, completionPolicy, actions }))))
}

function convertPhase(phase: unknown): Result<unknown, RoutineParseError> {
  return !isRecord(phase)
    ? { success: true, value: phase }
    : mergePhaseFields(
        phase,
        convertDurationField(phase.duration),
        convertCompletionPolicy(phase.completionPolicy),
        convertActions(phase.actions),
      )
}

function convertPhaseList(phases: readonly unknown[]): Result<readonly unknown[], RoutineParseError> {
  return phases.reduce<Result<readonly unknown[], RoutineParseError>>(
    (acc, phase) => andThen(acc, converted => map(convertPhase(phase), value => [...converted, value])),
    { success: true, value: [] },
  )
}

/** See checkPhaseGraphIntegrity's own doc comment for why this lives here rather than on PhaseGraphSchema itself. */
function rejectIntegrityIssues(graph: PhaseGraph): RoutineParseResult {
  const issues = checkPhaseGraphIntegrity(graph)
  return issues.length === 0
    ? { success: true, graph }
    : {
        success: false,
        error: {
          message: 'Routine file failed PhaseGraph referential-integrity validation.',
          issues: issues.map(issue => ({ path: [], message: issue.message })),
        },
      }
}

function runSchema(converted: unknown): RoutineParseResult {
  const schemaResult = PhaseGraphSchema.safeParse(converted)
  return schemaResult.success
    ? rejectIntegrityIssues(schemaResult.data)
    : {
        success: false,
        error: {
          message: 'Routine file failed PhaseGraph schema validation.',
          issues: schemaResult.error.issues.map(issue => ({ path: issue.path, message: issue.message })),
        },
      }
}

function validateConverted(parsed: unknown): RoutineParseResult {
  const phasesResult = isRecord(parsed) && Array.isArray(parsed.phases)
    ? convertPhaseList(parsed.phases)
    : null
  return phasesResult !== null && !phasesResult.success
    ? phasesResult
    : runSchema(
        isRecord(parsed) && phasesResult !== null
          ? { ...parsed, phases: phasesResult.value }
          : parsed,
      )
}

function parseExtractedJson(json: string): RoutineParseResult {
  const parsed = tryParseJson(json)
  return !parsed.success
    ? { success: false, error: { message: 'Routine file\'s fenced JSON block is not valid JSON.' } }
    : validateConverted(parsed.value)
}

/**
 * Parses a routine file's raw note content into a PhaseGraph: extracts the
 * single fenced JSON block, parses it, converts ISO 8601 duration strings at
 * `phases[].duration` and `phases[].completionPolicy.after` (futureDate only)
 * to Temporal.Duration, then validates via PhaseGraphSchema unchanged. Also
 * rejects graphs that are schema-valid but referentially broken — duplicate
 * phase ids, dangling transition references, or a reachable phase with no
 * (or no unconditional) way out (flow-gu1.31, see checkPhaseGraphIntegrity).
 * Never throws — every failure path returns a RoutineParseError (see design.md
 * decisions 3-4).
 */
export function parseRoutineFile(content: string): RoutineParseResult {
  const blockResult = extractJsonBlock(content)
  return !blockResult.success ? blockResult : parseExtractedJson(blockResult.value)
}
