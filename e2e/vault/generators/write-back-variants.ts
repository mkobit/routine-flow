import { routineFileNote, routineReadme } from '../routine-note'
import type { NoteDefinition } from '../schema'

export function generateWriteBackVariantsNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'write-back-variants',
      'The write-back-variants routine tests activeItem vs callback write-back behavior.',
    ),
    routineFileNote(
      'write-back-variants',
      'write-back-variants-routine.md',
      {
        id: 'write-back-variants',
        name: 'Write-back variants',
        phases: [
          {
            id: 'active-write',
            label: 'Active item write-back',
            kind: 'focus',
            duration: 'PT10S',
            taskSourceId: 'focus-queue',
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: 'write-back',
            onSkip: null,
            onExit: null,
          },
          {
            id: 'callback-write',
            label: 'Callback write-back',
            kind: 'focus',
            duration: 'PT10S',
            taskSourceId: 'focus-queue',
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'callback', name: 'dailyNote' },
            onEnter: null,
            onComplete: 'write-back',
            onSkip: null,
            onExit: null,
          },
          {
            id: 'no-write',
            label: 'No write-back',
            kind: 'focus',
            duration: 'PT10S',
            taskSourceId: 'focus-queue',
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
          { fromPhaseId: 'active-write', toPhaseId: 'callback-write', condition: { kind: 'always' } },
          { fromPhaseId: 'callback-write', toPhaseId: 'no-write', condition: { kind: 'always' } },
          { fromPhaseId: 'no-write', toPhaseId: 'active-write', condition: { kind: 'always' } },
        ],
      },
      'Write-back variants routine',
      'Hand-authored routine file for verifying write-back targets.',
    ),
  ]
}
