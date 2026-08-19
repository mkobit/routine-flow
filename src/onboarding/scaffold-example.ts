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
export const EXERCISE_ROUTINE_PATH = `${EXAMPLE_FOLDER_PATH}/Exercise & Stretch Routine.md`
export const MORNING_ROUTINE_PATH = `${EXAMPLE_FOLDER_PATH}/Morning Checklist Routine.md`
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
      "name": "Focus",
      "duration": "PT25M",
      "onCompletion": "autoAdvance",
      "taskSourceId": "focus-queue",
      "logTarget": {
        "kind": "activeItem"
      },
      "handlers": {
        "onComplete": [
          {
            "kind": "script",
            "scriptPath": "write-back"
          }
        ]
      }
    },
    {
      "id": "break",
      "name": "Short break",
      "duration": "PT5M",
      "onCompletion": "autoAdvance",
      "taskSourceId": "break-queue",
      "logTarget": {
        "kind": "activeItem"
      },
      "handlers": {}
    },
    {
      "id": "long-break",
      "name": "Long break",
      "duration": "PT15M",
      "onCompletion": "autoAdvance",
      "taskSourceId": "break-queue",
      "logTarget": {
        "kind": "activeItem"
      },
      "handlers": {}
    }
  ],
  "transitions": [
    {
      "from": "focus",
      "to": "long-break",
      "guard": {
        "kind": "everyNth",
        "count": 4
      }
    },
    {
      "from": "focus",
      "to": "break",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "break",
      "to": "focus",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "long-break",
      "to": "focus",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
\`\`\`
`

export const EXERCISE_ROUTINE_CONTENT = `---
is-routine: true
---
# Exercise & Stretch Routine

A timed exercise sequence with warm-up, sets, rest periods, and a terminal cool-down.

\`\`\`json
{
  "id": "exercise-stretch",
  "name": "Exercise & Stretch Routine",
  "phases": [
    {
      "id": "warmup",
      "name": "Warm-up",
      "duration": "PT3M",
      "onCompletion": "autoAdvance",
      "handlers": {
        "onEnter": [
          {
            "kind": "preset",
            "preset": "notify",
            "params": {
              "body": "Warm-up starting"
            }
          }
        ]
      }
    },
    {
      "id": "set-1",
      "name": "Work Set 1",
      "duration": "PT45S",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "rest-1",
      "name": "Rest",
      "duration": "PT15S",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "set-2",
      "name": "Work Set 2",
      "duration": "PT45S",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "cooldown",
      "name": "Cool-down",
      "duration": "PT2M",
      "onCompletion": "autoAdvance",
      "handlers": {
        "onComplete": [
          {
            "kind": "preset",
            "preset": "notify",
            "params": {
              "body": "Workout finished!"
            }
          }
        ]
      }
    }
  ],
  "transitions": [
    {
      "from": "warmup",
      "to": "set-1",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "set-1",
      "to": "rest-1",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "rest-1",
      "to": "set-2",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "set-2",
      "to": "cooldown",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
\`\`\`
`

export const MORNING_ROUTINE_CONTENT = `---
is-routine: true
---
# Morning Checklist Routine

A manual step-by-step morning routine requiring explicit manual completion to advance each phase.

\`\`\`json
{
  "id": "morning-routine",
  "name": "Morning Routine",
  "phases": [
    {
      "id": "hydrate",
      "name": "Hydrate & Stretch",
      "duration": "PT5M",
      "onCompletion": "waitForManual",
      "handlers": {}
    },
    {
      "id": "plan-day",
      "name": "Review Daily Goals",
      "duration": "PT10M",
      "onCompletion": "waitForManual",
      "handlers": {}
    },
    {
      "id": "morning-focus",
      "name": "Morning Focus",
      "duration": "PT25M",
      "onCompletion": "waitForManual",
      "taskSourceId": "focus-queue",
      "handlers": {}
    }
  ],
  "transitions": [
    {
      "from": "hydrate",
      "to": "plan-day",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "plan-day",
      "to": "morning-focus",
      "guard": {
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
  { path: EXERCISE_ROUTINE_PATH, content: EXERCISE_ROUTINE_CONTENT },
  { path: MORNING_ROUTINE_PATH, content: MORNING_ROUTINE_CONTENT },
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
