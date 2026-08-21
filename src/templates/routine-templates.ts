export interface RoutineTemplate {
  readonly id: string
  readonly name: string
  readonly category: string
  readonly description: string
  readonly phaseSummary: string
  readonly suggestedFileName: string
  readonly markdownContent: string
}

export const ROUTINE_CATEGORIES = [
  'All',
  'Focus & intervals',
  'Meetings & agendas',
  'Rituals & habits',
  'Movement & ergonomics',
  'Task queues & triage',
] as const

export const ROUTINE_TEMPLATES: readonly RoutineTemplate[] = [
  {
    id: 'pomodoro-standard',
    name: 'Standard Pomodoro',
    category: 'Focus & intervals',
    description: 'Classic 25-minute focus intervals with 5-minute short breaks and a 15-minute long break every 4th cycle.',
    phaseSummary: 'Focus (25m) → Short break (5m) → Long break (15m)',
    suggestedFileName: 'Pomodoro Routine.md',
    markdownContent: `---
is-routine: true
---
# Standard Pomodoro

Classic 25-minute focus intervals with 5-minute short breaks and a 15-minute long break every 4th cycle.

\`\`\`json
{
  "id": "pomodoro-standard",
  "name": "Standard Pomodoro",
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
      "id": "short-break",
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
      "to": "short-break",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "short-break",
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
`,
  },
  {
    id: 'ultradian-rhythm',
    name: 'Ultradian 90/20 rhythm',
    category: 'Focus & intervals',
    description: 'Deep cognitive focus block of 90 minutes paired with a 20-minute restorative recovery break.',
    phaseSummary: 'Deep work (90m) → Cognitive recovery (20m)',
    suggestedFileName: 'Ultradian 90-20 Routine.md',
    markdownContent: `---
is-routine: true
---
# Ultradian 90/20 rhythm

Deep cognitive focus block of 90 minutes paired with a 20-minute restorative recovery break.

\`\`\`json
{
  "id": "ultradian-rhythm",
  "name": "Ultradian 90/20 rhythm",
  "phases": [
    {
      "id": "deep-work",
      "name": "Ultradian deep work",
      "duration": "PT90M",
      "onCompletion": "waitForManual",
      "taskSourceId": "ultradian-queue",
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
      "id": "recovery",
      "name": "Cognitive recovery",
      "duration": "PT20M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    }
  ],
  "transitions": [
    {
      "from": "deep-work",
      "to": "recovery",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "recovery",
      "to": "deep-work",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
\`\`\`
`,
  },
  {
    id: 'variable-break-ladder',
    name: 'Variable break ladder',
    category: 'Focus & intervals',
    description: 'Multi-tier recovery schedule scaling from 5-minute short breaks to 10-minute and 20-minute extended breaks.',
    phaseSummary: 'Focus (25m) → Short (5m) / Medium (10m) / Long (20m) breaks',
    suggestedFileName: 'Variable Break Ladder Routine.md',
    markdownContent: `---
is-routine: true
---
# Variable break ladder

Multi-tier recovery schedule scaling from 5-minute short breaks to 10-minute and 20-minute extended breaks.

\`\`\`json
{
  "id": "variable-break-ladder",
  "name": "Variable break ladder",
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
      "id": "long-break",
      "name": "Long break",
      "duration": "PT20M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "medium-break",
      "name": "Medium break",
      "duration": "PT10M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "short-break",
      "name": "Short break",
      "duration": "PT5M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    }
  ],
  "transitions": [
    {
      "from": "focus",
      "to": "long-break",
      "guard": {
        "kind": "everyNth",
        "count": 8
      }
    },
    {
      "from": "focus",
      "to": "medium-break",
      "guard": {
        "kind": "everyNth",
        "count": 4
      }
    },
    {
      "from": "focus",
      "to": "short-break",
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
    },
    {
      "from": "medium-break",
      "to": "focus",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "short-break",
      "to": "focus",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
\`\`\`
`,
  },
  {
    id: 'silent-meeting-agenda',
    name: 'Silent meeting agenda',
    category: 'Meetings & agendas',
    description: 'Amazon-style silent proposal reading followed by context framing, group discussion, and action-item assignment.',
    phaseSummary: 'Pre-read (5m) → Context (3m) → Discussion (20m) → Action items (4m)',
    suggestedFileName: 'Silent Meeting Agenda Routine.md',
    markdownContent: `---
is-routine: true
---
# Silent meeting agenda

Amazon-style silent proposal reading followed by context framing, group discussion, and action-item assignment.

\`\`\`json
{
  "id": "silent-meeting-agenda",
  "name": "Silent meeting agenda",
  "phases": [
    {
      "id": "pre-read",
      "name": "Silent pre-read",
      "duration": "PT5M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "context",
      "name": "Context framing",
      "duration": "PT3M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "discussion",
      "name": "Open discussion",
      "duration": "PT20M",
      "onCompletion": "waitForManual",
      "handlers": {}
    },
    {
      "id": "action-items",
      "name": "Action items and owners",
      "duration": "PT4M",
      "onCompletion": "waitForManual",
      "handlers": {}
    }
  ],
  "transitions": [
    {
      "from": "pre-read",
      "to": "context",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "context",
      "to": "discussion",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "discussion",
      "to": "action-items",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
\`\`\`
`,
  },
  {
    id: 'sprint-retrospective',
    name: 'Sprint retrospective',
    category: 'Meetings & agendas',
    description: 'Structured agile reflection framework: metrics review, celebrate wins, uncover blockers, and create action plans.',
    phaseSummary: 'Recap (5m) → Wins (10m) → Deltas (15m) → Action plan (10m)',
    suggestedFileName: 'Sprint Retrospective Routine.md',
    markdownContent: `---
is-routine: true
---
# Sprint retrospective

Structured agile reflection framework: metrics review, celebrate wins, uncover blockers, and create action plans.

\`\`\`json
{
  "id": "sprint-retrospective",
  "name": "Sprint retrospective",
  "phases": [
    {
      "id": "recap",
      "name": "Sprint metric recap",
      "duration": "PT5M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "wins",
      "name": "Celebrate wins",
      "duration": "PT10M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "deltas",
      "name": "Identify deltas and blockers",
      "duration": "PT15M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "action-plan",
      "name": "Action planning",
      "duration": "PT10M",
      "onCompletion": "waitForManual",
      "handlers": {}
    }
  ],
  "transitions": [
    {
      "from": "recap",
      "to": "wins",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "wins",
      "to": "deltas",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "deltas",
      "to": "action-plan",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
\`\`\`
`,
  },
  {
    id: 'workday-shutdown-ritual',
    name: 'Workday shutdown ritual',
    category: 'Rituals & habits',
    description: 'Establish clear boundaries between focused work and evening recovery with triage, daily logging, and workspace tidy-up.',
    phaseSummary: 'Inbox triage (10m) → Daily log (5m) → Tomorrow plan (5m) → Untimed workspace tidy',
    suggestedFileName: 'Workday Shutdown Ritual.md',
    markdownContent: `---
is-routine: true
---
# Workday shutdown ritual

Establish clear boundaries between focused work and evening recovery with triage, daily logging, and workspace tidy-up.

\`\`\`json
{
  "id": "workday-shutdown-ritual",
  "name": "Workday shutdown ritual",
  "phases": [
    {
      "id": "inbox-triage",
      "name": "Inbox and notification triage",
      "duration": "PT10M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "daily-log",
      "name": "Daily log summary",
      "duration": "PT5M",
      "onCompletion": "waitForManual",
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
      "id": "tomorrow-plan",
      "name": "Tomorrow plan and priorities",
      "duration": "PT5M",
      "onCompletion": "waitForManual",
      "handlers": {}
    },
    {
      "id": "desk-tidy",
      "name": "Workspace tidy and shutdown sign-off",
      "duration": null,
      "onCompletion": "waitForManual",
      "handlers": {}
    }
  ],
  "transitions": [
    {
      "from": "inbox-triage",
      "to": "daily-log",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "daily-log",
      "to": "tomorrow-plan",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "tomorrow-plan",
      "to": "desk-tidy",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
\`\`\`
`,
  },
  {
    id: 'morning-kickoff',
    name: 'Morning kickoff',
    category: 'Rituals & habits',
    description: 'Kickstart the day with intentional schedule alignment, top 3 task triage, and workspace preparation.',
    phaseSummary: 'Calendar review (5m) → Task triage (5m) → Deep work prep (5m)',
    suggestedFileName: 'Morning Kickoff Routine.md',
    markdownContent: `---
is-routine: true
---
# Morning kickoff

Kickstart the day with intentional schedule alignment, top 3 task triage, and workspace preparation.

\`\`\`json
{
  "id": "morning-kickoff",
  "name": "Morning kickoff",
  "phases": [
    {
      "id": "calendar-review",
      "name": "Review schedule and commitments",
      "duration": "PT5M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "task-triage",
      "name": "Select top 3 focus priorities",
      "duration": "PT5M",
      "onCompletion": "waitForManual",
      "handlers": {}
    },
    {
      "id": "deep-work-prep",
      "name": "Workspace and tool setup",
      "duration": "PT5M",
      "onCompletion": "waitForManual",
      "handlers": {}
    }
  ],
  "transitions": [
    {
      "from": "calendar-review",
      "to": "task-triage",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "task-triage",
      "to": "deep-work-prep",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
\`\`\`
`,
  },
  {
    id: 'desk-micro-movement',
    name: 'Desk micro-movement & eye reset',
    category: 'Movement & ergonomics',
    description: 'Combat sedentary screen fatigue with 20-20-20 eye rests every 20 minutes and hourly posture mobility stretches.',
    phaseSummary: 'Desk work (20m) → 20-20-20 eye reset (20s) → Posture stretch (2m)',
    suggestedFileName: 'Desk Micro-Movement Routine.md',
    markdownContent: `---
is-routine: true
---
# Desk micro-movement & eye reset

Combat sedentary screen fatigue with 20-20-20 eye rests every 20 minutes and hourly posture mobility stretches.

\`\`\`json
{
  "id": "desk-micro-movement",
  "name": "Desk micro-movement and eye reset",
  "phases": [
    {
      "id": "desk-work",
      "name": "Desk work",
      "duration": "PT20M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "eye-reset",
      "name": "20-20-20 eye reset",
      "duration": "PT20S",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "standing-stretch",
      "name": "Mobility and posture stretch",
      "duration": "PT2M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    }
  ],
  "transitions": [
    {
      "from": "desk-work",
      "to": "standing-stretch",
      "guard": {
        "kind": "everyNth",
        "count": 3
      }
    },
    {
      "from": "desk-work",
      "to": "eye-reset",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "eye-reset",
      "to": "desk-work",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "standing-stretch",
      "to": "desk-work",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
\`\`\`
`,
  },
  {
    id: 'exercise-stretch-circuit',
    name: 'Exercise & stretch circuit',
    category: 'Movement & ergonomics',
    description: 'Interval workout circuit with warm-up, timed exercise sets, rest intervals, and terminal cool-down.',
    phaseSummary: 'Warm-up (3m) → Set 1 (45s) → Rest (15s) → Set 2 (45s) → Cool-down (2m)',
    suggestedFileName: 'Exercise & Stretch Circuit.md',
    markdownContent: `---
is-routine: true
---
# Exercise & stretch circuit

Interval workout circuit with warm-up, timed exercise sets, rest intervals, and terminal cool-down.

\`\`\`json
{
  "id": "exercise-stretch-circuit",
  "name": "Exercise & stretch circuit",
  "phases": [
    {
      "id": "warmup",
      "name": "Warm-up",
      "duration": "PT3M",
      "onCompletion": "autoAdvance",
      "handlers": {}
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
      "handlers": {}
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
`,
  },
  {
    id: 'bug-triage-blitz',
    name: 'Bug triage blitz',
    category: 'Task queues & triage',
    description: 'Rapid issue resolution sprints alternating 15-minute triage intervals with 3-minute breathers, automatically branching to wrap-up when the queue empties.',
    phaseSummary: 'Triage sprint (15m) ⇄ Breather (3m) → Wrap-up (10m) on queue empty',
    suggestedFileName: 'Bug Triage Blitz.md',
    markdownContent: `---
is-routine: true
---
# Bug triage blitz

Rapid issue resolution sprints alternating 15-minute triage intervals with 3-minute breathers, automatically branching to wrap-up when the queue empties.

\`\`\`json
{
  "id": "bug-triage-blitz",
  "name": "Bug triage blitz",
  "phases": [
    {
      "id": "triage-sprint",
      "name": "Bug triage sprint",
      "duration": "PT15M",
      "onCompletion": "autoAdvance",
      "taskSourceId": "bug-queue",
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
      "id": "breather",
      "name": "Intermission breather",
      "duration": "PT3M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    },
    {
      "id": "wrapup",
      "name": "PR wrap-up and submission",
      "duration": "PT10M",
      "onCompletion": "waitForManual",
      "handlers": {}
    }
  ],
  "transitions": [
    {
      "from": "triage-sprint",
      "to": "wrapup",
      "guard": {
        "kind": "queueExhausted"
      }
    },
    {
      "from": "triage-sprint",
      "to": "breather",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "breather",
      "to": "triage-sprint",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
\`\`\`
`,
  },
  {
    id: 'chore-list-blitz',
    name: 'Quick chores blitz',
    category: 'Task queues & triage',
    description: 'Manual-clear chores blitz supporting frontmatter priority updates, task deferrals, and queue cycling.',
    phaseSummary: 'Active chore (10m, manual clear) ⇄ Quick breather (2m)',
    suggestedFileName: 'Quick Chores Blitz.md',
    markdownContent: `---
is-routine: true
---
# Quick chores blitz

Manual-clear chores blitz supporting frontmatter priority updates, task deferrals, and queue cycling.

\`\`\`json
{
  "id": "chore-list",
  "name": "Quick chores blitz",
  "phases": [
    {
      "id": "chore-item",
      "name": "Active chore",
      "duration": "PT10M",
      "onCompletion": "waitForManual",
      "taskSourceId": "chore-queue",
      "logTarget": {
        "kind": "activeItem"
      },
      "actions": [
        {
          "id": "done",
          "label": "Done",
          "style": "primary",
          "payload": {
            "kind": "markDone"
          }
        },
        {
          "id": "cycle",
          "label": "Cycle to back",
          "payload": {
            "kind": "queueCycle"
          }
        },
        {
          "id": "defer",
          "label": "Defer 1 day",
          "payload": {
            "kind": "deferDuration",
            "after": "P1D"
          }
        }
      ],
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
      "id": "quick-break",
      "name": "Quick breather",
      "duration": "PT2M",
      "onCompletion": "autoAdvance",
      "handlers": {}
    }
  ],
  "transitions": [
    {
      "from": "chore-item",
      "to": "quick-break",
      "guard": {
        "kind": "always"
      }
    },
    {
      "from": "quick-break",
      "to": "chore-item",
      "guard": {
        "kind": "always"
      }
    }
  ]
}
\`\`\`
`,
  },
]
