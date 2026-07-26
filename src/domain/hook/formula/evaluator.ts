import type { PhaseId } from '../../phase/phase'
import type { Predicate } from '../predicate'
import type { ComparisonOperator } from './tokenizer'
import type { FormulaExpression } from './parser'
import { parseFormula } from './parser'

export type FormulaValueType = 'number' | 'string' | 'boolean'

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
      (leftType !== rightType
        ? { ok: false, error: `Comparison operands must be the same type, got ${leftType} and ${rightType}` }
        : leftType === 'boolean'
          ? { ok: false, error: 'Comparison operators cannot be applied to boolean values' }
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
            (thenType !== elseType
              ? { ok: false, error: `"if" branches must have the same type, got ${thenType} and ${elseType}` }
              : { ok: true, type: thenType })))))
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
            : expr.kind === 'comparison'
              ? inferComparisonType(expr.left, expr.right)
              : expr.kind === 'and' || expr.kind === 'or'
                ? inferBooleanPairType(expr.kind, expr.left, expr.right)
                : expr.kind === 'not'
                  ? inferNotType(expr.operand)
                  : inferIfType(expr.condition, expr.thenBranch, expr.elseBranch)
}

export type FormulaValue = number | string | boolean

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

/** inferType guarantees same-typed, non-boolean operands reach one of the two typed branches in practice; a type mismatch static inference didn't catch falls back to equality-only rather than throwing. */
function compareValues(operator: ComparisonOperator, left: FormulaValue, right: FormulaValue): boolean {
  return typeof left === 'number' && typeof right === 'number'
    ? compareNumbers(operator, left, right)
    : typeof left === 'string' && typeof right === 'string'
      ? compareStrings(operator, left, right)
      : operator === '=='
        ? left === right
        : operator === '!='
          ? left !== right
          : false
}

function evaluateExpression(expr: FormulaExpression, fromPhaseId: string, visitCounts: Readonly<Record<string, number>>): FormulaValue {
  return expr.kind === 'number'
    ? expr.value
    : expr.kind === 'string'
      ? expr.value
      : expr.kind === 'boolean'
        ? expr.value
        : expr.kind === 'fromPhaseId'
          ? fromPhaseId
          : expr.kind === 'visitCount'
            ? visitCounts[expr.phaseKey] ?? 0
            : expr.kind === 'comparison'
              ? compareValues(
                  expr.operator,
                  evaluateExpression(expr.left, fromPhaseId, visitCounts),
                  evaluateExpression(expr.right, fromPhaseId, visitCounts),
                )
              : expr.kind === 'and'
                ? evaluateExpression(expr.left, fromPhaseId, visitCounts) && evaluateExpression(expr.right, fromPhaseId, visitCounts)
                : expr.kind === 'or'
                  ? evaluateExpression(expr.left, fromPhaseId, visitCounts) || evaluateExpression(expr.right, fromPhaseId, visitCounts)
                  : expr.kind === 'not'
                    ? !evaluateExpression(expr.operand, fromPhaseId, visitCounts)
                    : evaluateExpression(expr.condition, fromPhaseId, visitCounts)
                      ? evaluateExpression(expr.thenBranch, fromPhaseId, visitCounts)
                      : evaluateExpression(expr.elseBranch, fromPhaseId, visitCounts)
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
          predicate: (fromPhaseId: PhaseId, visitCounts: Readonly<Record<PhaseId, number>>) => {
            const result = evaluateExpression(expression, fromPhaseId, visitCounts)
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
