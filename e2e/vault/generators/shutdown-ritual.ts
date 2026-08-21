import { routineFileNote, routineReadme } from '../routine-note'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

export function generateShutdownRitualNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'shutdown-ritual',
      'The shutdown-ritual routine guides a structured end-of-day workday shutdown: inbox triage, daily log entry, planning tomorrow\'s top priorities, and tidy-up, finishing at an untimed terminal phase.\n`Shutdown-checklist.md` tracks routine guidelines.',
    ),
    routineFileNote(
      'shutdown-ritual',
      'shutdown-ritual-routine.md',
      {
        id: 'shutdown-ritual',
        name: 'Workday shutdown ritual',
        phases: [
          {
            id: 'inbox-triage',
            label: 'Inbox and notification triage',
            kind: 'ritual',
            duration: 'PT10M',
            taskSourceId: null,
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'daily-log',
            label: 'Daily log summary',
            kind: 'ritual',
            duration: 'PT5M',
            taskSourceId: null,
            completionPolicy: { kind: 'manualClear' },
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'tomorrow-plan',
            label: 'Tomorrow plan and priorities',
            kind: 'ritual',
            duration: 'PT5M',
            taskSourceId: null,
            completionPolicy: { kind: 'manualClear' },
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'desk-tidy',
            label: 'Workspace tidy and shutdown sign-off',
            kind: 'ritual',
            duration: null,
            taskSourceId: null,
            completionPolicy: { kind: 'manualClear' },
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
        ],
        transitions: [
          { fromPhaseId: 'inbox-triage', toPhaseId: 'daily-log', condition: { kind: 'always' } },
          { fromPhaseId: 'daily-log', toPhaseId: 'tomorrow-plan', condition: { kind: 'always' } },
          { fromPhaseId: 'tomorrow-plan', toPhaseId: 'desk-tidy', condition: { kind: 'always' } },
        ],
      },
      'Workday shutdown ritual routine',
      'Hand-authored routine file for daily closure with terminal desk-tidy phase.',
    ),
    createNote(
      'shutdown-ritual/Shutdown-checklist.md',
      { habits: ['Close browser tabs', 'Archive triage emails', 'Set status to offline'] },
      'Checklist notes for the shutdown ritual routine.',
    ),
  ]
}
