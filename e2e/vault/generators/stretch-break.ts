import { routineFileNote, routineReadme } from '../routine-note'
import type { NoteDefinition } from '../schema'

export function generateStretchBreakNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'stretch-break',
      'The stretch-break routine (see dev-docs/examples/stretch-break.md) has no queue — taskSourceId is null on its one phase, so there is nothing to generate here.',
    ),
    routineFileNote(
      'stretch-break',
      'stretch-break-routine.md',
      {
        id: 'stretch-break',
        name: 'Stretch break',
        phases: [
          {
            id: 'stretch',
            label: 'Stretch interval',
            kind: 'break',
            duration: 'PT45S',
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
            id: 'rest',
            label: 'Rest interval',
            kind: 'break',
            duration: 'PT15S',
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
            id: 'done',
            label: 'Routine complete',
            kind: 'break',
            duration: null,
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
          { fromPhaseId: 'rest', toPhaseId: 'done', condition: { kind: 'everyNth', n: 5 } },
          { fromPhaseId: 'stretch', toPhaseId: 'rest', condition: { kind: 'always' } },
          { fromPhaseId: 'rest', toPhaseId: 'stretch', condition: { kind: 'always' } },
        ],
      },
      'Stretch break routine',
      'Hand-authored routine file for desk stretch breaks.',
    ),
  ]
}
