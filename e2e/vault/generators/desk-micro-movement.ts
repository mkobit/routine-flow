import { routineFileNote, routineReadme } from '../routine-note'
import type { NoteDefinition } from '../schema'

export function generateDeskMicroMovementNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'desk-micro-movement',
      'The desk-micro-movement routine prompts a 20-second distant gaze reset every 20 minutes, escalating to a 2-minute posture stretch every 3rd cycle (1 hour).',
    ),
    routineFileNote(
      'desk-micro-movement',
      'desk-micro-movement-routine.md',
      {
        id: 'desk-micro-movement',
        name: 'Desk micro-movement and eye reset',
        phases: [
          {
            id: 'desk-work',
            label: 'Desk work',
            kind: 'focus',
            duration: 'PT20M',
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
            id: 'eye-reset',
            label: '20-20-20 eye reset',
            kind: 'break',
            duration: 'PT20S',
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
            id: 'standing-stretch',
            label: 'Mobility and posture stretch',
            kind: 'break',
            duration: 'PT2M',
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
          { fromPhaseId: 'desk-work', toPhaseId: 'standing-stretch', condition: { kind: 'everyNth', n: 3 } },
          { fromPhaseId: 'desk-work', toPhaseId: 'eye-reset', condition: { kind: 'always' } },
          { fromPhaseId: 'eye-reset', toPhaseId: 'desk-work', condition: { kind: 'always' } },
          { fromPhaseId: 'standing-stretch', toPhaseId: 'desk-work', condition: { kind: 'always' } },
        ],
      },
      'Desk micro-movement routine',
      'Hand-authored routine file for regular ergonomic micro-breaks.',
    ),
  ]
}
