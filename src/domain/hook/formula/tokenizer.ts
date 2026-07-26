/** A reserved word in the formula grammar — see parser.ts for the full grammar. */
export type Keyword = 'if' | 'and' | 'or' | 'not' | 'true' | 'false'

/** A comparison operator supported by the formula grammar. */
export type ComparisonOperator = '==' | '!=' | '>=' | '<=' | '>' | '<'

type Punct = '(' | ')' | ',' | '.'

export type Token
  = | { readonly kind: 'number', readonly value: number, readonly position: number }
    | { readonly kind: 'string', readonly value: string, readonly position: number }
    | { readonly kind: 'identifier', readonly value: string, readonly position: number }
    | { readonly kind: 'keyword', readonly value: Keyword, readonly position: number }
    | { readonly kind: 'operator', readonly value: ComparisonOperator, readonly position: number }
    | { readonly kind: 'punct', readonly value: Punct, readonly position: number }

export type TokenizeResult
  = | { readonly ok: true, readonly tokens: readonly Token[] }
    | { readonly ok: false, readonly error: string }

const TOKEN_PATTERN
  = /(\s+)|([A-Za-z_][A-Za-z0-9_]*)|(\d+(?:\.\d+)?)|("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(==|!=|>=|<=|>|<|\(|\)|,|\.)|(.)/g

function toKeyword(text: string): Keyword | null {
  return text === 'if' || text === 'and' || text === 'or' || text === 'not' || text === 'true' || text === 'false'
    ? text
    : null
}

function unescapeStringBody(body: string): string {
  return body.replace(/\\(.)/g, '$1')
}

type Classified
  = | { readonly kind: 'skip' }
    | { readonly kind: 'token', readonly token: Token }
    | { readonly kind: 'invalid', readonly char: string }

function classifyIdentifierOrKeyword(text: string, position: number): Classified {
  const keyword = toKeyword(text)
  return keyword === null
    ? { kind: 'token', token: { kind: 'identifier', value: text, position } }
    : { kind: 'token', token: { kind: 'keyword', value: keyword, position } }
}

function classifyOperatorOrPunct(text: string, position: number): Classified {
  return text === '==' || text === '!=' || text === '>=' || text === '<=' || text === '>' || text === '<'
    ? { kind: 'token', token: { kind: 'operator', value: text, position } }
    : text === '(' || text === ')' || text === ',' || text === '.'
      ? { kind: 'token', token: { kind: 'punct', value: text, position } }
      : { kind: 'invalid', char: text }
}

function classify(match: RegExpMatchArray): Classified {
  const position = match.index ?? 0
  return match[1] !== undefined
    ? { kind: 'skip' }
    : match[2] !== undefined
      ? classifyIdentifierOrKeyword(match[2], position)
      : match[3] !== undefined
        ? { kind: 'token', token: { kind: 'number', value: Number(match[3]), position } }
        : match[4] !== undefined
          ? { kind: 'token', token: { kind: 'string', value: unescapeStringBody(match[4].slice(1, -1)), position } }
          : match[5] !== undefined
            ? { kind: 'token', token: { kind: 'string', value: unescapeStringBody(match[5].slice(1, -1)), position } }
            : match[6] !== undefined
              ? classifyOperatorOrPunct(match[6], position)
              : { kind: 'invalid', char: match[7] ?? match[0] }
}

/** Lexes a formula source string into a flat token stream, or a single error describing the first unrecognized character. */
export function tokenize(source: string): TokenizeResult {
  const matches = [...source.matchAll(TOKEN_PATTERN)]
  return matches.reduce<TokenizeResult>((acc, match) => {
    const classified = classify(match)
    return !acc.ok
      ? acc
      : classified.kind === 'skip'
        ? acc
        : classified.kind === 'invalid'
          ? { ok: false, error: `Unexpected character "${classified.char}" at position ${match.index ?? 0}` }
          : { ok: true, tokens: [...acc.tokens, classified.token] }
  }, { ok: true, tokens: [] })
}
