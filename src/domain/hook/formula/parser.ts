import type { ComparisonOperator, Token } from './tokenizer'
import { tokenize } from './tokenizer'

/**
 * Grammar for a `'custom'` TransitionCondition predicate formula, modeled on
 * (not calling into — see design.md) Obsidian Bases' own formula vocabulary.
 * Deliberately not Turing-complete: no assignment, no user-defined functions,
 * no loops/recursion, no I/O.
 *
 * ```
 * formula     = orExpr
 * orExpr      = andExpr { "or" andExpr }
 * andExpr     = notExpr { "and" notExpr }
 * notExpr     = "not" notExpr | comparison
 * comparison  = primary [ compareOp primary ]
 * compareOp   = "==" | "!=" | ">=" | "<=" | ">" | "<"
 * primary     = ifExpr | literal | reference | "(" orExpr ")"
 * ifExpr      = "if" "(" orExpr "," orExpr "," orExpr ")"
 * literal     = number | string | "true" | "false"
 * reference   = "fromPhaseId" | "visitCounts" "." identifier
 * ```
 *
 * `reference` is the grammar's entire identifier/member-access surface —
 * `fromPhaseId` resolves to the predicate's own `fromPhaseId` argument
 * (a string), `visitCounts.<name>` resolves to `visitCounts[name] ?? 0`.
 * No other identifier or member-access target is resolvable; a property name
 * that could reach the prototype chain (`constructor`, `__proto__`, etc.) is
 * rejected here at parse time rather than left to evaluation.
 *
 * Types are inferred statically (see evaluator.ts's `inferType`) rather than
 * checked at evaluation time: `fromPhaseId` is always `string`,
 * `visitCounts.<name>` is always `number`, comparisons require same-typed
 * non-boolean operands and produce `boolean`, `and`/`or`/`not` require and
 * produce `boolean`, and `if`'s two branches must agree in type. A formula
 * must type as `boolean` overall to be registrable as a `Predicate`.
 */
export type FormulaExpression
  = | { readonly kind: 'number', readonly value: number }
    | { readonly kind: 'string', readonly value: string }
    | { readonly kind: 'boolean', readonly value: boolean }
    | { readonly kind: 'fromPhaseId' }
    | { readonly kind: 'visitCount', readonly phaseKey: string }
    | { readonly kind: 'comparison', readonly operator: ComparisonOperator, readonly left: FormulaExpression, readonly right: FormulaExpression }
    | { readonly kind: 'and', readonly left: FormulaExpression, readonly right: FormulaExpression }
    | { readonly kind: 'or', readonly left: FormulaExpression, readonly right: FormulaExpression }
    | { readonly kind: 'not', readonly operand: FormulaExpression }
    | { readonly kind: 'if', readonly condition: FormulaExpression, readonly thenBranch: FormulaExpression, readonly elseBranch: FormulaExpression }

export type FormulaParseResult
  = | { readonly ok: true, readonly expression: FormulaExpression }
    | { readonly ok: false, readonly error: string }

type Parsed<T>
  = | { readonly ok: true, readonly value: T, readonly next: number }
    | { readonly ok: false, readonly error: string }

/** Result-monad bind for Parsed<T>: threads the next token index through a chain of parse steps without any conditional statement. */
function andThen<T, U>(result: Parsed<T>, step: (value: T, next: number) => Parsed<U>): Parsed<U> {
  return result.ok ? step(result.value, result.next) : result
}

/**
 * Own-property names of `Object.prototype` (and legacy accessor-pair names)
 * that a hand-rolled `visitCounts.<name>` member access must not be allowed
 * to resolve, closing off prototype-chain traversal as an injection vector.
 */
const RESERVED_PROPERTY_NAMES: ReadonlySet<string> = new Set([
  'constructor',
  '__proto__',
  'prototype',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
])

function describeToken(token: Token | undefined): string {
  return token === undefined ? 'end of formula' : `"${String(token.value)}"`
}

function expectPunct(tokens: readonly Token[], index: number, value: '(' | ')' | ',' | '.'): Parsed<Token> {
  const token = tokens[index]
  return token !== undefined && token.kind === 'punct' && token.value === value
    ? { ok: true, value: token, next: index + 1 }
    : { ok: false, error: `Expected "${value}" but found ${describeToken(token)}` }
}

function parseVisitCountAccess(tokens: readonly Token[], index: number): Parsed<FormulaExpression> {
  return andThen(expectPunct(tokens, index, '.'), (_dot, afterDot) => {
    const propertyToken = tokens[afterDot]
    return propertyToken === undefined || propertyToken.kind !== 'identifier'
      ? { ok: false, error: 'Expected a property name after "visitCounts."' }
      : RESERVED_PROPERTY_NAMES.has(propertyToken.value)
        ? { ok: false, error: `"visitCounts.${propertyToken.value}" references a disallowed prototype-chain property` }
        : { ok: true, value: { kind: 'visitCount', phaseKey: propertyToken.value }, next: afterDot + 1 }
  })
}

function parseParenthesized(tokens: readonly Token[], index: number): Parsed<FormulaExpression> {
  return andThen(parseOr(tokens, index), (expression, afterExpr) =>
    andThen(expectPunct(tokens, afterExpr, ')'), (_close, afterClose) =>
      ({ ok: true, value: expression, next: afterClose })))
}

function parsePrimary(tokens: readonly Token[], index: number): Parsed<FormulaExpression> {
  const token = tokens[index]
  return token === undefined
    ? { ok: false, error: 'Unexpected end of formula' }
    : token.kind === 'number'
      ? { ok: true, value: { kind: 'number', value: token.value }, next: index + 1 }
      : token.kind === 'string'
        ? { ok: true, value: { kind: 'string', value: token.value }, next: index + 1 }
        : token.kind === 'keyword' && (token.value === 'true' || token.value === 'false')
          ? { ok: true, value: { kind: 'boolean', value: token.value === 'true' }, next: index + 1 }
          : token.kind === 'keyword' && token.value === 'if'
            ? parseIf(tokens, index + 1)
            : token.kind === 'punct' && token.value === '('
              ? parseParenthesized(tokens, index + 1)
              : token.kind === 'identifier' && token.value === 'fromPhaseId'
                ? { ok: true, value: { kind: 'fromPhaseId' }, next: index + 1 }
                : token.kind === 'identifier' && token.value === 'visitCounts'
                  ? parseVisitCountAccess(tokens, index + 1)
                  : token.kind === 'identifier'
                    ? { ok: false, error: `Unknown identifier "${token.value}" — only "fromPhaseId" and "visitCounts.<phaseId>" are allowed` }
                    : { ok: false, error: `Unexpected token ${describeToken(token)}` }
}

function parseIf(tokens: readonly Token[], index: number): Parsed<FormulaExpression> {
  return andThen(expectPunct(tokens, index, '('), (_open, afterOpen) =>
    andThen(parseOr(tokens, afterOpen), (condition, afterCondition) =>
      andThen(expectPunct(tokens, afterCondition, ','), (_comma1, afterComma1) =>
        andThen(parseOr(tokens, afterComma1), (thenBranch, afterThen) =>
          andThen(expectPunct(tokens, afterThen, ','), (_comma2, afterComma2) =>
            andThen(parseOr(tokens, afterComma2), (elseBranch, afterElse) =>
              andThen(expectPunct(tokens, afterElse, ')'), (_close, afterClose) =>
                ({ ok: true, value: { kind: 'if', condition, thenBranch, elseBranch }, next: afterClose }))))))))
}

function parseComparison(tokens: readonly Token[], index: number): Parsed<FormulaExpression> {
  return andThen(parsePrimary(tokens, index), (left, afterLeft): Parsed<FormulaExpression> => {
    const opToken = tokens[afterLeft]
    return opToken === undefined || opToken.kind !== 'operator'
      ? { ok: true, value: left, next: afterLeft }
      : andThen(parsePrimary(tokens, afterLeft + 1), (right, afterRight) =>
          ({ ok: true, value: { kind: 'comparison', operator: opToken.value, left, right }, next: afterRight }))
  })
}

function parseNot(tokens: readonly Token[], index: number): Parsed<FormulaExpression> {
  const token = tokens[index]
  return token !== undefined && token.kind === 'keyword' && token.value === 'not'
    ? andThen(parseNot(tokens, index + 1), (operand, next) => ({ ok: true, value: { kind: 'not', operand }, next }))
    : parseComparison(tokens, index)
}

function parseAndTail(left: FormulaExpression, tokens: readonly Token[], index: number): Parsed<FormulaExpression> {
  const token = tokens[index]
  return token !== undefined && token.kind === 'keyword' && token.value === 'and'
    ? andThen(parseNot(tokens, index + 1), (right, next) => parseAndTail({ kind: 'and', left, right }, tokens, next))
    : { ok: true, value: left, next: index }
}

function parseAnd(tokens: readonly Token[], index: number): Parsed<FormulaExpression> {
  return andThen(parseNot(tokens, index), (left, next) => parseAndTail(left, tokens, next))
}

function parseOrTail(left: FormulaExpression, tokens: readonly Token[], index: number): Parsed<FormulaExpression> {
  const token = tokens[index]
  return token !== undefined && token.kind === 'keyword' && token.value === 'or'
    ? andThen(parseAnd(tokens, index + 1), (right, next) => parseOrTail({ kind: 'or', left, right }, tokens, next))
    : { ok: true, value: left, next: index }
}

function parseOr(tokens: readonly Token[], index: number): Parsed<FormulaExpression> {
  return andThen(parseAnd(tokens, index), (left, next) => parseOrTail(left, tokens, next))
}

function finishParse(result: Parsed<FormulaExpression>, tokens: readonly Token[]): FormulaParseResult {
  return !result.ok
    ? { ok: false, error: result.error }
    : result.next !== tokens.length
      ? { ok: false, error: `Unexpected trailing input after position ${tokens[result.next]?.position ?? 0}` }
      : { ok: true, expression: result.value }
}

/** Parses a formula source string into a FormulaExpression AST, or a single error describing the first problem found. */
export function parseFormula(source: string): FormulaParseResult {
  const tokenized = tokenize(source)
  return !tokenized.ok
    ? { ok: false, error: tokenized.error }
    : finishParse(parseOr(tokenized.tokens, 0), tokenized.tokens)
}
