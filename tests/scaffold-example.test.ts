import { describe, expect, test } from 'bun:test'
import { parseRoutineFile } from '../src/domain/routine/routine-file'
import {
  EXAMPLE_FOLDER_PATH,
  EXERCISE_ROUTINE_CONTENT,
  EXERCISE_ROUTINE_PATH,
  MORNING_ROUTINE_CONTENT,
  MORNING_ROUTINE_PATH,
  POMODORO_ROUTINE_CONTENT,
  POMODORO_ROUTINE_PATH,
  SAMPLE_BASE_CONTENT,
  SAMPLE_BASE_PATH,
  SAMPLE_TASK_CONTENT,
  SAMPLE_TASK_PATH,
  scaffoldExampleRoutine,
  type ScaffoldVaultPort,
} from '../src/onboarding/scaffold-example'

class FakeVault implements ScaffoldVaultPort {
  public createdFolders: string[]
  public files: Map<string, string>

  constructor(initialFolders: readonly string[] = [], initialFiles: readonly (readonly [string, string])[] = []) {
    this.createdFolders = [...initialFolders]
    this.files = new Map(initialFiles)
  }

  getAbstractFileByPath(path: string): unknown {
    if (this.createdFolders.includes(path) || this.files.has(path)) {
      return {}
    }
    return null
  }

  async createFolder(path: string): Promise<unknown> {
    this.createdFolders.push(path)
    return {}
  }

  async create(path: string, data: string): Promise<unknown> {
    this.files.set(path, data)
    return {}
  }
}

describe('scaffoldExampleRoutine', () => {
  test('scaffolds folder and example files when none exist', async () => {
    const fakeVault = new FakeVault()

    const result = await scaffoldExampleRoutine(fakeVault)

    expect(fakeVault.createdFolders).toEqual([EXAMPLE_FOLDER_PATH])
    expect(result.createdPaths).toEqual([
      POMODORO_ROUTINE_PATH,
      EXERCISE_ROUTINE_PATH,
      MORNING_ROUTINE_PATH,
      SAMPLE_TASK_PATH,
      SAMPLE_BASE_PATH,
    ])
    expect(result.skippedPaths).toEqual([])

    expect(fakeVault.files.get(POMODORO_ROUTINE_PATH)).toBe(POMODORO_ROUTINE_CONTENT)
    expect(fakeVault.files.get(EXERCISE_ROUTINE_PATH)).toBe(EXERCISE_ROUTINE_CONTENT)
    expect(fakeVault.files.get(MORNING_ROUTINE_PATH)).toBe(MORNING_ROUTINE_CONTENT)
    expect(fakeVault.files.get(SAMPLE_TASK_PATH)).toBe(SAMPLE_TASK_CONTENT)
    expect(fakeVault.files.get(SAMPLE_BASE_PATH)).toBe(SAMPLE_BASE_CONTENT)
  })

  test('skips files that already exist and creates missing ones', async () => {
    const fakeVault = new FakeVault(
      [EXAMPLE_FOLDER_PATH],
      [[POMODORO_ROUTINE_PATH, 'existing routine']],
    )

    const result = await scaffoldExampleRoutine(fakeVault)

    expect(result.createdPaths).toEqual([
      EXERCISE_ROUTINE_PATH,
      MORNING_ROUTINE_PATH,
      SAMPLE_TASK_PATH,
      SAMPLE_BASE_PATH,
    ])
    expect(result.skippedPaths).toEqual([
      POMODORO_ROUTINE_PATH,
    ])
    expect(fakeVault.files.get(POMODORO_ROUTINE_PATH)).toBe('existing routine')
  })

  test('scaffolded pomodoro routine file content is a valid routine graph', () => {
    const parseResult = parseRoutineFile(POMODORO_ROUTINE_CONTENT)
    expect(parseResult.success).toBe(true)
    if (parseResult.success) {
      expect(String(parseResult.graph.id)).toBe('pomodoro')
      expect(parseResult.graph.phases).toHaveLength(3)
      expect(String(parseResult.graph.phases[0]?.id)).toBe('focus')
      expect(String(parseResult.graph.phases[1]?.id)).toBe('break')
      expect(String(parseResult.graph.phases[2]?.id)).toBe('long-break')
    }
  })

  test('scaffolded exercise routine file content is a valid terminal-node routine graph', () => {
    const parseResult = parseRoutineFile(EXERCISE_ROUTINE_CONTENT)
    expect(parseResult.success).toBe(true)
    if (parseResult.success) {
      expect(String(parseResult.graph.id)).toBe('exercise-stretch')
      expect(parseResult.graph.phases).toHaveLength(5)
      expect(String(parseResult.graph.phases[4]?.id)).toBe('cooldown')
    }
  })

  test('scaffolded morning routine file content is a valid waitForManual routine graph', () => {
    const parseResult = parseRoutineFile(MORNING_ROUTINE_CONTENT)
    expect(parseResult.success).toBe(true)
    if (parseResult.success) {
      expect(String(parseResult.graph.id)).toBe('morning-routine')
      expect(parseResult.graph.phases).toHaveLength(3)
      expect(parseResult.graph.phases[0]?.onCompletion).toBe('waitForManual')
    }
  })
})
