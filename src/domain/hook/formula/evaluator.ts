import type { Predicate, PredicateContext } from '../predicate'
import type { ComparisonOperator } from './tokenizer'
import type { FormulaExpression } from './parser'
import { parseFormula } from './parser'

export type FormulaValueType = 'number' | 'string' | 'boolean' | 'any'

type TypeResult
  = | { readonly ok: true, readonly type: FormulaValueType }
    | { readonly ok: false, readonly error: string }

/** Result-monad bind for TypeResult, mirroring parser.ts's andThen. */
function chainType(result: TypeResult, step: (type: FormulaValueType) => TypeResult): TypeResult {
  return result.ok ? step(result.type) : result
}

function inferComparisonType(left: FormulaExpression, right: FormulaExpression): TypeResult {
  return chainType(inferType(left), leftType =>
    chainType(inferType(right), rightType =>
      (leftType === 'boolean' || rightType === 'boolean'
        ? { ok: false, error: 'Comparison operators cannot be applied to boolean values' }
        : leftType !== rightType && leftType !== 'any' && rightType !== 'any'
          ? { ok: false, error: `Comparison operands must be the same type, got ${leftType} and ${rightType}` }
          : { ok: true, type: 'boolean' })))
}

function inferBooleanPairType(kind: 'and' | 'or', left: FormulaExpression, right: FormulaExpression): TypeResult {
  return chainType(inferType(left), leftType =>
    (leftType !== 'boolean'
      ? { ok: false, error: `"${kind}" requires boolean operands, got ${leftType}` }
      : chainType(inferType(right), rightType =>
          (rightType !== 'boolean'
            ? { ok: false, error: `"${kind}" requires boolean operands, got ${rightType}` }
            : { ok: true, type: 'boolean' }))))
}

function inferNotType(operand: FormulaExpression): TypeResult {
  return chainType(inferType(operand), operandType =>
    (operandType !== 'boolean'
      ? { ok: false, error: `"not" requires a boolean operand, got ${operandType}` }
      : { ok: true, type: 'boolean' }))
}

function inferIfType(condition: FormulaExpression, thenBranch: FormulaExpression, elseBranch: FormulaExpression): TypeResult {
  return chainType(inferType(condition), conditionType =>
    (conditionType !== 'boolean'
      ? { ok: false, error: `"if" condition must be boolean, got ${conditionType}` }
      : chainType(inferType(thenBranch), thenType =>
          chainType(inferType(elseBranch), elseType =>
            (thenType !== elseType && thenType !== 'any' && elseType !== 'any'
              ? { ok: false, error: `"if" branches must have the same type, got ${thenType} and ${elseType}` }
              : { ok: true, type: thenType === 'any' ? elseType : thenType })))))
}

/**
 * Statically infers a FormulaExpression's value type, so an ill-typed
 * formula (e.g. comparing a number to a string, or a formula that doesn't
 * evaluate to boolean overall) fails at registration rather than at
 * evaluation time — see compileFormula.
 */
function inferType(expr: FormulaExpression): TypeResult {
  return expr.kind === 'number'
    ? { ok: true, type: 'number' }
    : expr.kind === 'string'
      ? { ok: true, type: 'string' }
      : expr.kind === 'boolean'
        ? { ok: true, type: 'boolean' }
        : expr.kind === 'fromPhaseId'
          ? { ok: true, type: 'string' }
          : expr.kind === 'visitCount'
            ? { ok: true, type: 'number' }
            : expr.kind === 'trackerProperty'
              ? { ok: true, type: 'any' }
              : expr.kind === 'comparison'
                ? inferComparisonType(expr.left, expr.right)
                : expr.kind === 'and' || expr.kind === 'or'
                  ? inferBooleanPairType(expr.kind, expr.left, expr.right)
                  : expr.kind === 'not'
                    ? inferNotType(expr.operand)
                    : inferIfType(expr.condition, expr.thenBranch, expr.elseBranch)
}

export type FormulaValue = number | string | boolean | undefined

function compareNumbers(operator: ComparisonOperator, left: number, right: number): boolean {
  return operator === '=='
    ? left === right
    : operator === '!='
      ? left !== right
      : operator === '>'
        ? left > right
        : operator === '>='
          ? left >= right
          : operator === '<'
            ? left < right
            : left <= right
}

function compareStrings(operator: ComparisonOperator, left: string, right: string): boolean {
  return operator === '=='
    ? left === right
    : operator === '!='
      ? left !== right
      : operator === '>'
        ? left > right
        : operator === '>='
          ? left >= right
          : operator === '<'
            ? left < right
            : left <= right
}

/** inferType guarantees compatible non-boolean operands reach one of the two typed branches in practice; a runtime type mismatch (e.g. on dynamic tracker frontmatter) fails closed rather than throwing. */
function compareValues(operator: ComparisonOperator, left: FormulaValue, right: FormulaValue): boolean {
  return left === undefined || right === undefined
    ? false
    : typeof left === 'number' && typeof right === 'number'
      ? compareNumbers(operator, left, right)
      : typeof left === 'string' && typeof right === 'string'
        ? compareStrings(operator, left, right)
        : operator === '=='
          ? left === right
          : operator === '!='
            ? left !== right
            : false
}

function resolveTrackerProperty(
  trackerFrontmatter: Readonly<Record<string, unknown>> | undefined,
  property: string,
): FormulaValue {
  const hasOwn = trackerFrontmatter !== undefined && Object.prototype.hasOwnProperty.call(trackerFrontmatter, property)
  const raw = hasOwn ? trackerFrontmatter[property] : undefined
  return raw === undefined
    ? 0
    : typeof raw === 'number' && !Number.isNaN(raw)
      ? raw
      : typeof raw === 'string' || typeof raw === 'boolean'
        ? raw
        : undefined
}

interface EvaluationContext {
  readonly fromPhaseId: string
  readonly visitCounts: Readonly<Record<string, number>>
  readonly trackerFrontmatter?: Readonly<Record<string, unknown>>
}

function evaluateExpression(expr: FormulaExpression, context: EvaluationContext): FormulaValue {
  return expr.kind === 'number'
    ? expr.value
    : expr.kind === 'string'
      ? expr.value
      : expr.kind === 'boolean'
        ? expr.value
        : expr.kind === 'fromPhaseId'
          ? context.fromPhaseId
          : expr.kind === 'visitCount'
            ? context.visitCounts[expr.phaseKey] ?? 0
            : expr.kind === 'trackerProperty'
              ? resolveTrackerProperty(context.trackerFrontmatter, expr.property)
              : expr.kind === 'comparison'
                ? compareValues(
                    expr.operator,
                    evaluateExpression(expr.left, context),
                    evaluateExpression(expr.right, context),
                  )
                : expr.kind === 'and'
                  ? evaluateExpression(expr.left, context) && evaluateExpression(expr.right, context)
                  : expr.kind === 'or'
                    ? evaluateExpression(expr.left, context) || evaluateExpression(expr.right, context)
                    : expr.kind === 'not'
                      ? !evaluateExpression(expr.operand, context)
                      : evaluateExpression(expr.condition, context)
                        ? evaluateExpression(expr.thenBranch, context)
                        : evaluateExpression(expr.elseBranch, context)
}

export type CompiledFormula
  = | { readonly ok: true, readonly predicate: Predicate }
    | { readonly ok: false, readonly error: string }

function finishCompile(expression: FormulaExpression): CompiledFormula {
  const inferred = inferType(expression)
  return !inferred.ok
    ? { ok: false, error: inferred.error }
    : inferred.type !== 'boolean'
      ? { ok: false, error: `Formula must evaluate to a boolean, got ${inferred.type}` }
      : {
          ok: true,
          predicate: (context: PredicateContext) => {
            const result = evaluateExpression(expression, context)
            return typeof result === 'boolean' && result
          },
        }
}

/**
 * Parses, type-checks, and compiles a formula string into a synchronous
 * Predicate — the one entry point settings-tab registration (validate on
 * save) and MutableFormulaPredicateRegistry both use. Fails closed: any
 * parse or type error is returned as `ok: false`, never thrown.
 */
export function compileFormula(source: string): CompiledFormula {
  const parsed = parseFormula(source)
  return !parsed.ok
    ? { ok: false, error: parsed.error }
    : finishCompile(parsed.expression)
}
