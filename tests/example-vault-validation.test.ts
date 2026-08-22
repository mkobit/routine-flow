import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, test } from 'bun:test'
import { parseRoutineFile } from '../src/domain/routine/routine-file'
import {
  DEFAULT_VAULT_SEED,
  GENERATED_VAULT_FOLDERS,
  generateVault,
  rebuildGeneratedVault,
  resolveVaultSeed,
} from '../e2e/vault/generator'
import { serializeFrontmatter } from '../e2e/vault/serializer'

const isString = (m: unknown): m is string => typeof m === 'string'

function getNotePath(note: ReturnType<typeof generateVault>[number]): string {
  return path.posix.join(note.relativePath.dir, note.relativePath.base)
}

function getNoteContent(note: ReturnType<typeof generateVault>[number]): string {
  const frontmatterStr = serializeFrontmatter(note.frontmatter)
  return note.body !== undefined ? `${frontmatterStr}\n${note.body}` : frontmatterStr
}

describe('example vault validation', () => {
  test('resolveVaultSeed uses default seed or parses numeric env override', () => {
    expect(resolveVaultSeed({})).toBe(DEFAULT_VAULT_SEED)
    expect(resolveVaultSeed({ VAULT_SEED: '12345' })).toBe(12_345)
    expect(() => resolveVaultSeed({ VAULT_SEED: 'invalid' })).toThrow(/VAULT_SEED must be a finite number/)
  })

  test('generateVault produces all expected routine folders and files', () => {
    const notes = generateVault(DEFAULT_VAULT_SEED)
    expect(notes.length).toBeGreaterThan(20)

    for (const folder of GENERATED_VAULT_FOLDERS) {
      const folderNotes = notes.filter(n => getNotePath(n).startsWith(`${folder}/`))
      expect(folderNotes.length).toBeGreaterThan(0)

      // Each folder must have a README.md and a routine file
      const readme = folderNotes.find(n => getNotePath(n) === `${folder}/README.md`)
      expect(readme).toBeDefined()

      const routineNote = folderNotes.find(n => getNotePath(n).endsWith('-routine.md'))
      expect(routineNote).toBeDefined()
    }
  })

  test('all generated routine files parse as valid PhaseGraphs via parseRoutineFile', () => {
    const notes = generateVault(DEFAULT_VAULT_SEED)
    const routineNotes = notes.filter(n => getNotePath(n).endsWith('-routine.md'))

    expect(routineNotes.length).toBe(GENERATED_VAULT_FOLDERS.length)

    for (const note of routineNotes) {
      expect(note.frontmatter['is-routine']).toBe(true)

      const parseResult = parseRoutineFile(getNoteContent(note))
      expect(parseResult.success).toBe(true)
      if (parseResult.success) {
        expect(parseResult.graph.phases.length).toBeGreaterThan(0)
        expect(parseResult.graph.id.length).toBeGreaterThan(0)
        expect(parseResult.graph.name.length).toBeGreaterThan(0)
      }
    }
  })

  test('every routineFile in Tasks.base maps to a valid generated routine', async () => {
    const tasksBasePath = path.resolve(__dirname, '../routine-flow-example-vault/Tasks.base')
    const content = await fs.readFile(tasksBasePath, 'utf-8')
    const routineFileMatches = [...content.matchAll(/routineFile:\s*([^\s\n]+)/g)]
      .map(m => m[1])
      .filter(isString)

    expect(routineFileMatches.length).toBeGreaterThan(0)

    const notes = generateVault(DEFAULT_VAULT_SEED)
    const routinePaths = new Set(notes.map(getNotePath))

    for (const routineFile of routineFileMatches) {
      expect(routinePaths.has(routineFile)).toBe(true)
      const targetNote = notes.find(n => getNotePath(n) === routineFile)
      expect(targetNote).toBeDefined()
      if (targetNote !== undefined) {
        const parseResult = parseRoutineFile(getNoteContent(targetNote))
        expect(parseResult.success).toBe(true)
      }
    }
  })

  test('every routineFile in Dashboard.base maps to a valid generated routine', async () => {
    const dashboardBasePath = path.resolve(__dirname, '../routine-flow-example-vault/Dashboard.base')
    const content = await fs.readFile(dashboardBasePath, 'utf-8')
    const routineFileMatches = [...content.matchAll(/routineFile:\s*([^\s\n]+)/g)]
      .map(m => m[1])
      .filter(isString)

    expect(routineFileMatches.length).toBeGreaterThan(0)

    const notes = generateVault(DEFAULT_VAULT_SEED)
    const routinePaths = new Set(notes.map(getNotePath))

    for (const routineFile of routineFileMatches) {
      expect(routinePaths.has(routineFile)).toBe(true)
      const targetNote = notes.find(n => getNotePath(n) === routineFile)
      expect(targetNote).toBeDefined()
      if (targetNote !== undefined) {
        const parseResult = parseRoutineFile(getNoteContent(targetNote))
        expect(parseResult.success).toBe(true)
      }
    }
  })

  test('Focus-Dashboard.md embeds existing views from Dashboard.base', async () => {
    const dashboardMdPath = path.resolve(__dirname, '../routine-flow-example-vault/Focus-Dashboard.md')
    const dashboardBasePath = path.resolve(__dirname, '../routine-flow-example-vault/Dashboard.base')

    const mdContent = await fs.readFile(dashboardMdPath, 'utf-8')
    const baseContent = await fs.readFile(dashboardBasePath, 'utf-8')

    const viewNameMatches = [...baseContent.matchAll(/name:\s*([^\s\n][^\n]*)/g)]
      .map(m => m[1])
      .filter(isString)
      .map(s => s.trim())

    expect(viewNameMatches.length).toBeGreaterThan(0)

    const embedMatches = [...mdContent.matchAll(/!\[\[Dashboard\.base#([^\]]+)\]\]/g)]
      .map(m => m[1])
      .filter(isString)
      .map(s => s.trim())

    expect(embedMatches.length).toBeGreaterThan(0)

    for (const embedView of embedMatches) {
      expect(viewNameMatches).toContain(embedView)
    }
  })

  test('every routineFile in Daily-Routines.base maps to a valid generated routine', async () => {
    const dailyRoutinesBasePath = path.resolve(__dirname, '../routine-flow-example-vault/Daily-Routines.base')
    const content = await fs.readFile(dailyRoutinesBasePath, 'utf-8')
    const routineFileMatches = [...content.matchAll(/routineFile:\s*([^\s\n]+)/g)]
      .map(m => m[1])
      .filter(isString)

    expect(routineFileMatches.length).toBeGreaterThan(0)

    const notes = generateVault(DEFAULT_VAULT_SEED)
    const routinePaths = new Set(notes.map(getNotePath))

    for (const routineFile of routineFileMatches) {
      expect(routinePaths.has(routineFile)).toBe(true)
      const targetNote = notes.find(n => getNotePath(n) === routineFile)
      expect(targetNote).toBeDefined()
      if (targetNote !== undefined) {
        const parseResult = parseRoutineFile(getNoteContent(targetNote))
        expect(parseResult.success).toBe(true)
      }
    }
  })

  test('Daily-Template.md embeds existing views from Daily-Routines.base', async () => {
    const dailyTemplateMdPath = path.resolve(__dirname, '../routine-flow-example-vault/Daily-Template.md')
    const dailyRoutinesBasePath = path.resolve(__dirname, '../routine-flow-example-vault/Daily-Routines.base')

    const mdContent = await fs.readFile(dailyTemplateMdPath, 'utf-8')
    const baseContent = await fs.readFile(dailyRoutinesBasePath, 'utf-8')

    const viewNameMatches = [...baseContent.matchAll(/name:\s*([^\s\n][^\n]*)/g)]
      .map(m => m[1])
      .filter(isString)
      .map(s => s.trim())

    expect(viewNameMatches.length).toBeGreaterThan(0)

    const embedMatches = [...mdContent.matchAll(/!\[\[Daily-Routines\.base#([^\]]+)\]\]/g)]
      .map(m => m[1])
      .filter(isString)
      .map(s => s.trim())

    expect(embedMatches.length).toBeGreaterThan(0)

    for (const embedView of embedMatches) {
      expect(viewNameMatches).toContain(embedView)
    }
  })

  test('every routineFile in Priority-Queue.base maps to a valid generated routine', async () => {
    const priorityQueueBasePath = path.resolve(__dirname, '../routine-flow-example-vault/Priority-Queue.base')
    const content = await fs.readFile(priorityQueueBasePath, 'utf-8')
    const routineFileMatches = [...content.matchAll(/routineFile:\s*([^\s\n]+)/g)]
      .map(m => m[1])
      .filter(isString)

    expect(routineFileMatches.length).toBeGreaterThan(0)

    const notes = generateVault(DEFAULT_VAULT_SEED)
    const routinePaths = new Set(notes.map(getNotePath))

    for (const routineFile of routineFileMatches) {
      expect(routinePaths.has(routineFile)).toBe(true)
      const targetNote = notes.find(n => getNotePath(n) === routineFile)
      expect(targetNote).toBeDefined()
      if (targetNote !== undefined) {
        const parseResult = parseRoutineFile(getNoteContent(targetNote))
        expect(parseResult.success).toBe(true)
      }
    }
  })

  test('Priority-Dispatch.md embeds existing views from Priority-Queue.base', async () => {
    const priorityDispatchMdPath = path.resolve(__dirname, '../routine-flow-example-vault/Priority-Dispatch.md')
    const priorityQueueBasePath = path.resolve(__dirname, '../routine-flow-example-vault/Priority-Queue.base')

    const mdContent = await fs.readFile(priorityDispatchMdPath, 'utf-8')
    const baseContent = await fs.readFile(priorityQueueBasePath, 'utf-8')

    const viewNameMatches = [...baseContent.matchAll(/name:\s*([^\s\n][^\n]*)/g)]
      .map(m => m[1])
      .filter(isString)
      .map(s => s.trim())

    expect(viewNameMatches.length).toBeGreaterThan(0)

    const embedMatches = [...mdContent.matchAll(/!\[\[Priority-Queue\.base#([^\]]+)\]\]/g)]
      .map(m => m[1])
      .filter(isString)
      .map(s => s.trim())

    expect(embedMatches.length).toBeGreaterThan(0)

    for (const embedView of embedMatches) {
      expect(viewNameMatches).toContain(embedView)
    }
  })

  test('every routineFile in Audio-Notifications.base maps to a valid generated routine', async () => {
    const audioNotificationsBasePath = path.resolve(__dirname, '../routine-flow-example-vault/Audio-Notifications.base')
    const content = await fs.readFile(audioNotificationsBasePath, 'utf-8')
    const routineFileMatches = [...content.matchAll(/routineFile:\s*([^\s\n]+)/g)]
      .map(m => m[1])
      .filter(isString)

    expect(routineFileMatches.length).toBeGreaterThan(0)

    const notes = generateVault(DEFAULT_VAULT_SEED)
    const routinePaths = new Set(notes.map(getNotePath))

    for (const routineFile of routineFileMatches) {
      expect(routinePaths.has(routineFile)).toBe(true)
      const targetNote = notes.find(n => getNotePath(n) === routineFile)
      expect(targetNote).toBeDefined()
      if (targetNote !== undefined) {
        const parseResult = parseRoutineFile(getNoteContent(targetNote))
        expect(parseResult.success).toBe(true)
      }
    }
  })

  test('Audio-Notifications-Dashboard.md embeds existing views from Audio-Notifications.base', async () => {
    const audioDashboardMdPath = path.resolve(__dirname, '../routine-flow-example-vault/Audio-Notifications-Dashboard.md')
    const audioNotificationsBasePath = path.resolve(__dirname, '../routine-flow-example-vault/Audio-Notifications.base')

    const mdContent = await fs.readFile(audioDashboardMdPath, 'utf-8')
    const baseContent = await fs.readFile(audioNotificationsBasePath, 'utf-8')

    const viewNameMatches = [...baseContent.matchAll(/name:\s*([^\s\n][^\n]*)/g)]
      .map(m => m[1])
      .filter(isString)
      .map(s => s.trim())

    expect(viewNameMatches.length).toBeGreaterThan(0)

    const embedMatches = [...mdContent.matchAll(/!\[\[Audio-Notifications\.base#([^\]]+)\]\]/g)]
      .map(m => m[1])
      .filter(isString)
      .map(s => s.trim())

    expect(embedMatches.length).toBeGreaterThan(0)

    for (const embedView of embedMatches) {
      expect(viewNameMatches).toContain(embedView)
    }
  })

  test('rebuildGeneratedVault creates and cleans folders in target directory', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'routine-flow-test-vault-'))
    try {
      const errors = await rebuildGeneratedVault(tempDir, 999)
      expect(errors).toHaveLength(0)

      for (const folder of GENERATED_VAULT_FOLDERS) {
        const folderStat = await fs.stat(path.join(tempDir, folder))
        expect(folderStat.isDirectory()).toBe(true)
      }

      // Second rebuild should succeed cleanly (idempotent clean & rebuild)
      const secondErrors = await rebuildGeneratedVault(tempDir, 999)
      expect(secondErrors).toHaveLength(0)
    }
    finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})
