import { mock, test, expect, describe } from 'bun:test'
import { ObsidianFrontmatterReader } from '../src/timer/obsidian-frontmatter-reader'
import type { ObsidianFrontmatterReaderDeps } from '../src/timer/obsidian-frontmatter-reader'
import type { VaultFile } from '../src/timer/obsidian-file-mutation-port'

const fakeFile = (path: string): VaultFile => ({ path })

function createFakeDeps(file: VaultFile | null, cache: { frontmatter?: Record<string, unknown> } | null) {
  const getFileByPath = mock((_path: string) => file)
  const getFileCache = mock((_file: VaultFile) => cache)
  const deps: ObsidianFrontmatterReaderDeps = {
    vault: { getFileByPath },
    metadataCache: { getFileCache },
  }
  return { deps, getFileByPath, getFileCache }
}

describe('ObsidianFrontmatterReader', () => {
  test('readValue returns the frontmatter property from the resolved file\'s cache', () => {
    const file = fakeFile('task.md')
    const { deps, getFileCache } = createFakeDeps(file, { frontmatter: { sessions: 3 } })
    const reader = new ObsidianFrontmatterReader(deps)

    expect(reader.readValue('task.md', 'sessions')).toBe(3)
    expect(getFileCache).toHaveBeenCalledWith(file)
  })

  test('readValue returns undefined when the file has no metadata cache yet', () => {
    const { deps } = createFakeDeps(fakeFile('task.md'), null)
    const reader = new ObsidianFrontmatterReader(deps)

    expect(reader.readValue('task.md', 'sessions')).toBeUndefined()
  })

  test('readValue returns undefined when the cache has no frontmatter', () => {
    const { deps } = createFakeDeps(fakeFile('task.md'), {})
    const reader = new ObsidianFrontmatterReader(deps)

    expect(reader.readValue('task.md', 'sessions')).toBeUndefined()
  })

  test('readValue returns undefined when the property is absent from frontmatter', () => {
    const { deps } = createFakeDeps(fakeFile('task.md'), { frontmatter: { streak: 1 } })
    const reader = new ObsidianFrontmatterReader(deps)

    expect(reader.readValue('task.md', 'sessions')).toBeUndefined()
  })

  test('readValue throws when the path does not resolve to a file', () => {
    const { deps } = createFakeDeps(null, null)
    const reader = new ObsidianFrontmatterReader(deps)

    expect(() => reader.readValue('missing.md', 'sessions')).toThrow()
  })

  test('readAll returns the whole frontmatter record from the resolved file\'s cache', () => {
    const file = fakeFile('task.md')
    const { deps, getFileCache } = createFakeDeps(file, { frontmatter: { sessions: 3, streak: 1 } })
    const reader = new ObsidianFrontmatterReader(deps)

    expect(reader.readAll('task.md')).toEqual({ sessions: 3, streak: 1 })
    expect(getFileCache).toHaveBeenCalledWith(file)
  })

  test('readAll returns null when the file has no metadata cache yet', () => {
    const { deps } = createFakeDeps(fakeFile('task.md'), null)
    const reader = new ObsidianFrontmatterReader(deps)

    expect(reader.readAll('task.md')).toBeNull()
  })

  test('readAll returns null when the cache has no frontmatter', () => {
    const { deps } = createFakeDeps(fakeFile('task.md'), {})
    const reader = new ObsidianFrontmatterReader(deps)

    expect(reader.readAll('task.md')).toBeNull()
  })

  test('readAll throws when the path does not resolve to a file', () => {
    const { deps } = createFakeDeps(null, null)
    const reader = new ObsidianFrontmatterReader(deps)

    expect(() => reader.readAll('missing.md')).toThrow()
  })
})
