export interface ScaffoldVaultPort {
  readonly getAbstractFileByPath: (path: string) => unknown
  readonly createFolder: (path: string) => Promise<unknown>
  readonly create: (path: string, data: string) => Promise<unknown>
}

export interface ScaffoldResult {
  readonly createdPaths: readonly string[]
  readonly skippedPaths: readonly string[]
}

export const EXAMPLE_FOLDER_PATH = 'Routine Flow Examples'

export const POMODORO_ROUTINE_PATH = `${EXAMPLE_FOLDER_PATH}/Pomodoro Routine.md`
export const SAMPLE_TASK_PATH = `${EXAMPLE_FOLDER_PATH}/Sample Task.md`
export const SAMPLE_BASE_PATH = `${EXAMPLE_FOLDER_PATH}/Tasks.base`

export const POMODORO_ROUTINE_CONTENT = `---
is-routine: true
---
# Pomodoro Routine

A 25-minute focus session followed by a 5-minute short break, extending to a 15-minute long break every 4th cycle.

\`\`\`json
{
  "id": "pomodoro",
  "name": "Pomodoro",
  "phases": [
    {
      "id": "focus",
      "label": "Focus",
      "kind": "focus",
      "duration": "PT25M",
      "taskSourceId": "focus-queue",
      "completionPolicy": null,
      "notification": null,
      "logTarget": {
        "kind": "activeItem"
      },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "break",
      "label": "Short break",
      "kind": "break",
      "duration": "PT5M",
      "taskSourceId": "break-queue",
      "completionPolicy": null,
      "notification": null,
      "logTarget": {
        "kind": "activeItem"
      },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    },
    {
      "id": "long-break",
      "label": "Long break",
      "kind": "break",
      "duration": "PT15M",
      "taskSourceId": "break-queue",
      "completionPolicy": null,
      "notification": null,
      "logTarget": {
        "kind": "activeItem"
      },
      "onEnter": null,
      "onComplete": null,
      "onSkip": null,
      "onExit": null
    }
  ],
  "transitions": [
    {
      "fromPhaseId": "focus",
      "toPhaseId": "long-break",
      "condition": {
        "kind": "everyNth",
        "n": 4
      }
    },
    {
      "fromPhaseId": "focus",
      "toPhaseId": "break",
      "condition": {
        "kind": "always"
      }
    },
    {
      "fromPhaseId": "break",
      "toPhaseId": "focus",
      "condition": {
        "kind": "always"
      }
    },
    {
      "fromPhaseId": "long-break",
      "toPhaseId": "focus",
      "condition": {
        "kind": "always"
      }
    }
  ]
}
\`\`\`
`

export const SAMPLE_TASK_CONTENT = `---
routine-status: todo
routine-priority: 1
due: 2026-12-31
---
# Sample Task

This is a sample task for Routine Flow.
Tasks matching the focus/break task properties in your Routine Timer view will appear in the queue during the routine.
`

export const SAMPLE_BASE_CONTENT = `type: base
fields:
  - name: routine-status
    type: text
  - name: routine-priority
    type: number
views:
  - type: routine-timer
    name: Pomodoro Timer
    routineFile: Routine Flow Examples/Pomodoro Routine.md
`

const FILES_TO_SCAFFOLD: readonly { readonly path: string, readonly content: string }[] = [
  { path: POMODORO_ROUTINE_PATH, content: POMODORO_ROUTINE_CONTENT },
  { path: SAMPLE_TASK_PATH, content: SAMPLE_TASK_CONTENT },
  { path: SAMPLE_BASE_PATH, content: SAMPLE_BASE_CONTENT },
]

export async function scaffoldExampleRoutine(vault: ScaffoldVaultPort): Promise<ScaffoldResult> {
  const folderExists = vault.getAbstractFileByPath(EXAMPLE_FOLDER_PATH) !== null
  if (!folderExists) {
    await vault.createFolder(EXAMPLE_FOLDER_PATH)
  }

  const results = await Promise.all(
    FILES_TO_SCAFFOLD.map(async (fileSpec) => {
      const exists = vault.getAbstractFileByPath(fileSpec.path) !== null
      if (exists) {
        return { path: fileSpec.path, created: false }
      }
      await vault.create(fileSpec.path, fileSpec.content)
      return { path: fileSpec.path, created: true }
    }),
  )

  return {
    createdPaths: results.filter(r => r.created).map(r => r.path),
    skippedPaths: results.filter(r => !r.created).map(r => r.path),
  }
}
