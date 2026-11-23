import { test, expect, describe } from 'bun:test'
import { resolveActiveFilePath } from '../../src/timer/queue-advance'

describe('resolveActiveFilePath', () => {
  test('a null activeFilePath stays null', () => {
    expect(resolveActiveFilePath(null, ['a.md', 'b.md'])).toBeNull()
  })

  test('a path still present in the queue is unchanged', () => {
    expect(resolveActiveFilePath('b.md', ['a.md', 'b.md'])).toBe('b.md')
  })

  test('a path absent from the queue resolves to the first remaining entry', () => {
    expect(resolveActiveFilePath('gone.md', ['a.md', 'b.md'])).toBe('a.md')
  })

  test('a path absent from an empty queue resolves to null', () => {
    expect(resolveActiveFilePath('gone.md', [])).toBeNull()
  })
})
