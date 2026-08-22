import { routineFileNote, routineReadme } from '../routine-note'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

export function generateAudioChimeNotificationsNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'audio-chime-notifications',
      'The audio-chime-notifications routine demonstrates Web Audio synthesizer chimes, desktop notifications, and interval warning alerts triggered across phase lifecycle transitions.',
    ),
    routineFileNote(
      'audio-chime-notifications',
      'audio-chime-notifications-routine.md',
      {
        id: 'audio-chime-notifications',
        name: 'Audio chimes and desktop notifications',
        phases: [
          {
            id: 'focus',
            label: 'Focus interval',
            kind: 'focus',
            duration: 'PT25M',
            taskSourceId: 'focus-queue',
            completionPolicy: null,
            notification: {
              sound: 'chime-start',
              systemNotification: true,
            },
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
            handlers: {
              onEnter: [
                {
                  kind: 'script',
                  scriptPath: 'scripts/audio-chime-hook.js',
                  params: {
                    chord: 'major',
                    baseFreq: 523.25,
                  },
                },
                {
                  kind: 'preset',
                  preset: 'notify',
                  params: {
                    title: 'Routine Flow',
                    body: 'Focus interval started — time for deep work',
                    system: false,
                  },
                },
              ],
              onComplete: [
                {
                  kind: 'script',
                  scriptPath: 'scripts/audio-chime-hook.js',
                  params: {
                    chord: 'fanfare',
                    baseFreq: 659.25,
                  },
                },
                {
                  kind: 'preset',
                  preset: 'notify',
                  params: {
                    title: 'Routine Flow',
                    body: 'Focus interval complete! Great work.',
                    system: true,
                  },
                },
                {
                  kind: 'script',
                  scriptPath: 'write-back',
                },
              ],
              onSkip: [
                {
                  kind: 'script',
                  scriptPath: 'scripts/interval-warning-hook.js',
                  params: {
                    tone: 'skip',
                  },
                },
              ],
              onExit: [],
            },
          },
          {
            id: 'short-break',
            label: 'Short break',
            kind: 'break',
            duration: 'PT5M',
            taskSourceId: 'break-queue',
            completionPolicy: null,
            notification: {
              sound: 'soft-bell',
              systemNotification: true,
            },
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
            handlers: {
              onEnter: [
                {
                  kind: 'script',
                  scriptPath: 'scripts/audio-chime-hook.js',
                  params: {
                    chord: 'soft',
                    baseFreq: 440.0,
                  },
                },
                {
                  kind: 'preset',
                  preset: 'notify',
                  params: {
                    title: 'Routine Flow',
                    body: 'Short break started — rest your eyes and stretch',
                    system: false,
                  },
                },
              ],
              onComplete: [
                {
                  kind: 'script',
                  scriptPath: 'scripts/audio-chime-hook.js',
                  params: {
                    chord: 'alert',
                    baseFreq: 587.33,
                  },
                },
                {
                  kind: 'preset',
                  preset: 'notify',
                  params: {
                    title: 'Routine Flow',
                    body: 'Short break ended — ready for the next focus session',
                    system: true,
                  },
                },
              ],
              onSkip: [],
              onExit: [],
            },
          },
          {
            id: 'long-break',
            label: 'Long restorative break',
            kind: 'break',
            duration: 'PT15M',
            taskSourceId: 'break-queue',
            completionPolicy: null,
            notification: {
              sound: 'restorative-bell',
              systemNotification: true,
            },
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
            handlers: {
              onEnter: [
                {
                  kind: 'script',
                  scriptPath: 'scripts/audio-chime-hook.js',
                  params: {
                    chord: 'restorative',
                    baseFreq: 392.0,
                  },
                },
                {
                  kind: 'preset',
                  preset: 'notify',
                  params: {
                    title: 'Routine Flow',
                    body: 'Long break started — step away from your desk',
                    system: true,
                  },
                },
              ],
              onComplete: [
                {
                  kind: 'script',
                  scriptPath: 'scripts/audio-chime-hook.js',
                  params: {
                    chord: 'fanfare',
                    baseFreq: 523.25,
                  },
                },
                {
                  kind: 'preset',
                  preset: 'notify',
                  params: {
                    title: 'Routine Flow',
                    body: 'Long break concluded — cycle reset',
                    system: true,
                  },
                },
              ],
              onSkip: [],
              onExit: [],
            },
          },
        ],
        transitions: [
          {
            fromPhaseId: 'focus',
            toPhaseId: 'long-break',
            condition: {
              kind: 'everyNth',
              n: 4,
            },
          },
          {
            fromPhaseId: 'focus',
            toPhaseId: 'short-break',
            condition: {
              kind: 'always',
            },
          },
          {
            fromPhaseId: 'short-break',
            toPhaseId: 'focus',
            condition: {
              kind: 'always',
            },
          },
          {
            fromPhaseId: 'long-break',
            toPhaseId: 'focus',
            condition: {
              kind: 'always',
            },
          },
        ],
      },
      'Audio chimes and desktop notifications routine',
      'Hand-authored routine file demonstrating audio chimes, desktop notifications, and interval warning alerts.',
    ),
    createNote(
      'audio-chime-notifications/01-deep-work-architecture.md',
      {
        'title': 'Architect auth boundary',
        'type': 'work',
        'status': 'in-progress',
        'priority': 1,
        'routine-priority': 1,
        'routine-status': 'pending',
        'tags': ['focus', 'architecture'],
        'sessions': 2,
      },
      '# Architect auth boundary\n\nDeep focus task with configured audio and notification alerts.\n',
    ),
    createNote(
      'audio-chime-notifications/02-code-review-refactor.md',
      {
        'title': 'Review pull request feedback',
        'type': 'work',
        'status': 'todo',
        'priority': 2,
        'routine-priority': 2,
        'routine-status': 'pending',
        'tags': ['focus', 'review'],
        'sessions': 0,
      },
      '# Review pull request feedback\n\nSecondary focus task for the audio chime routine queue.\n',
    ),
  ]
}
