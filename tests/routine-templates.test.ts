import { describe, expect, test } from 'bun:test'
import { ROUTINE_CATEGORIES, ROUTINE_TEMPLATES } from '../src/templates/routine-templates'
import { importRoutineTemplate, type TemplateVaultPort } from '../src/templates/template-importer'
import { parseRoutineFile } from '../src/domain/routine/routine-file'
import { PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'

class FakeTemplateVault implements TemplateVaultPort {
  public createdFolders: string[]
  public files: Map<string, string>

  constructor(initialFolders: readonly string[] = [], initialFiles: readonly (readonly [string, string])[] = []) {
    this.createdFolders = [...initialFolders]
    this.files = new Map(initialFiles)
  }

  getAbstractFileByPath(path: string): unknown {
    if (this.createdFolders.includes(path) || this.files.has(path)) {
      return { path }
    }
    return null
  }

  async createFolder(path: string): Promise<unknown> {
    this.createdFolders.push(path)
    return { path }
  }

  async create(path: string, data: string): Promise<unknown> {
    this.files.set(path, data)
    return { path }
  }
}

describe('routine templates catalog', () => {
  test('includes pre-built templates across all declared categories', () => {
    expect(ROUTINE_TEMPLATES.length).toBeGreaterThanOrEqual(10)
    for (const category of ROUTINE_CATEGORIES) {
      if (category === 'All') {
        continue
      }
      const templatesInCategory = ROUTINE_TEMPLATES.filter(t => t.category === category)
      expect(templatesInCategory.length).toBeGreaterThanOrEqual(1)
    }
  })

  test('all pre-built routine templates parse as valid PhaseGraphs via parseRoutineFile', () => {
    for (const template of ROUTINE_TEMPLATES) {
      const result = parseRoutineFile(template.markdownContent)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.graph.phases.length).toBeGreaterThanOrEqual(1)
        expect(result.graph.name.length).toBeGreaterThan(0)
      }
    }
  })

  test('each template has valid non-empty metadata fields', () => {
    for (const template of ROUTINE_TEMPLATES) {
      expect(template.id.length).toBeGreaterThan(0)
      expect(template.name.length).toBeGreaterThan(0)
      expect(template.category.length).toBeGreaterThan(0)
      expect(template.description.length).toBeGreaterThan(0)
      expect(template.phaseSummary.length).toBeGreaterThan(0)
      expect(template.suggestedFileName.endsWith('.md')).toBe(true)
    }
  })
})

describe('template importer', () => {
  test('imports a template to default Routines folder and creates folder when needed', async () => {
    const vault = new FakeTemplateVault()
    const template = ROUTINE_TEMPLATES[0]
    expect(template).toBeDefined()
    if (!template) {
      return
    }

    const result = await importRoutineTemplate(vault, template)
    expect(result.success).toBe(true)
    expect(result.path).toBe(`Routines/${template.suggestedFileName}`)
    expect(vault.createdFolders).toContain('Routines')
    expect(vault.files.get(`Routines/${template.suggestedFileName}`)).toBe(template.markdownContent)
  })

  test('fails gracefully if file already exists and overwrite is false', async () => {
    const template = ROUTINE_TEMPLATES[0]
    expect(template).toBeDefined()
    if (!template) {
      return
    }

    const expectedPath = `Routines/${template.suggestedFileName}`
    const vault = new FakeTemplateVault(['Routines'], [[expectedPath, 'existing content']])

    const result = await importRoutineTemplate(vault, template)
    expect(result.success).toBe(false)
    expect(result.error).toContain('File already exists')
    expect(vault.files.get(expectedPath)).toBe('existing content')
  })

  test('overwrites existing file when overwrite option is true', async () => {
    const template = ROUTINE_TEMPLATES[0]
    expect(template).toBeDefined()
    if (!template) {
      return
    }

    const expectedPath = `Routines/${template.suggestedFileName}`
    const vault = new FakeTemplateVault(['Routines'], [[expectedPath, 'existing content']])

    const result = await importRoutineTemplate(vault, template, { overwrite: true })
    expect(result.success).toBe(true)
    expect(result.path).toBe(expectedPath)
    expect(vault.files.get(expectedPath)).toBe(template.markdownContent)
  })

  test('supports custom destination folder and custom file name', async () => {
    const vault = new FakeTemplateVault()
    const template = ROUTINE_TEMPLATES[1]
    expect(template).toBeDefined()
    if (!template) {
      return
    }

    const result = await importRoutineTemplate(vault, template, {
      destinationFolder: 'My Workflows/Templates',
      fileName: 'Custom Ultradian.md',
    })

    expect(result.success).toBe(true)
    expect(result.path).toBe('My Workflows/Templates/Custom Ultradian.md')
    expect(vault.createdFolders).toContain('My Workflows')
    expect(vault.createdFolders).toContain('My Workflows/Templates')
    expect(vault.files.get('My Workflows/Templates/Custom Ultradian.md')).toBe(template.markdownContent)
  })
})

describe('leitner box spaced review template and portfolio', () => {
  test('leitner box template contains review grade actions across boxes 1 to 4', () => {
    const template = ROUTINE_TEMPLATES.find(t => t.id === 'leitner-box')
    expect(template).toBeDefined()
    if (!template) {
      return
    }

    expect(template.category).toBe('Task queues & triage')
    const result = parseRoutineFile(template.markdownContent)
    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }

    const reviewPhase = result.graph.phases.find(p => p.id === 'review')
    expect(reviewPhase).toBeDefined()
    expect(reviewPhase?.duration).toBeNull()
    expect(reviewPhase?.actions).toHaveLength(4)

    const actionIds = reviewPhase?.actions.map(a => a.id)
    expect(actionIds).toEqual(['grade-again', 'grade-hard', 'grade-good', 'grade-easy'])

    const again = reviewPhase?.actions.find(a => a.id === 'grade-again')
    expect(again?.payload.kind).toBe('deferDuration')
    if (again?.payload.kind === 'deferDuration') {
      expect(again.payload.box).toBe(1)
      expect(again.payload.property).toBe('routine-due')
    }

    const good = reviewPhase?.actions.find(a => a.id === 'grade-good')
    expect(good?.payload.kind).toBe('deferDuration')
    if (good?.payload.kind === 'deferDuration') {
      expect(good.payload.box).toBe(3)
      expect(good.payload.property).toBe('routine-due')
    }
  })

  test('scaffolded leitner-box-routine.md conforms to RoutineFileSchema', async () => {
    const routinePath = 'routine-flow-example-vault/leitner-box/leitner-box-routine.md'
    const content = await Bun.file(routinePath).text()
    const result = parseRoutineFile(content)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.graph.id).toBe(PhaseGraphIdSchema.parse('leitner-box'))
      expect(result.graph.phases[0]?.actions).toHaveLength(4)
    }
  })

  test('Tasks.base includes configured view with date filter', async () => {
    const tasksBasePath = 'routine-flow-example-vault/Tasks.base'
    const content = await Bun.file(tasksBasePath).text()
    expect(content).toContain('filters:')
    expect(content).toMatch(/filters:\s*\n\s*and:\s*\n\s*-\s*note\.due\s*<=\s*today/)
  })
})
