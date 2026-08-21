import { routineFileNote, routineReadme } from '../routine-note'
import type { NoteDefinition } from '../schema'

export function generateManualClearNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'manual-clear',
      'The manual-clear routine tests explicit manual clearing of timed phases.',
    ),
    routineFileNote(
      'manual-clear',
      'manual-clear-routine.md',
      {
        id: 'manual-clear',
        name: 'Manual clear',
        phases: [
          {
            id: 'focus',
            label: 'Focus',
            kind: 'focus',
            duration: 'PT5S',
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
            id: 'break',
            label: 'Break',
            kind: 'break',
            duration: 'PT3S',
            taskSourceId: null,
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
        ],
        transitions: [
          { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
          { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
        ],
      },
      'Manual clear routine',
      'Hand-authored routine file for testing manualClear completion.',
    ),
  ]
}
