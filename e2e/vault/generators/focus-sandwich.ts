import fc from 'fast-check'
import { indexedPath, routineFileNote, routineReadme } from '../routine-note'
import { ANCHOR_DATE } from '../seed'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

const FOCUS_SANDWICH_TASKS = [
  'Refactor state store subscriptions',
  'Design queue item action schema',
  'Author user guide for focus routines',
  'Optimize Bases view re-renders',
] as const

export function generateFocusSandwichNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.record({
    title: fc.constantFrom(...FOCUS_SANDWICH_TASKS),
    dueOffsetDays: fc.integer({ min: 0, max: 3 }),
  })
  const samples = fc.sample(arb, { numRuns: 3, seed })
  return [
    routineReadme(
      'focus-sandwich',
      'The focus-sandwich routine structures deep work into three phases: an untimed intention-setting warm-up, a timed deep focus sprint, and a cooldown reflection with frontmatter write-back to active task notes.',
    ),
    routineFileNote(
      'focus-sandwich',
      'focus-sandwich-routine.md',
      {
        id: 'focus-sandwich',
        name: 'Focus sandwich',
        phases: [
          {
            id: 'warmup',
            label: 'Intention warm-up',
            kind: 'warmup',
            duration: null,
            taskSourceId: 'focus-queue',
            completionPolicy: { kind: 'manualClear' },
            notification: null,
            logTarget: null,
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
            handlers: {
              onEnter: [
                {
                  kind: 'preset',
                  preset: 'notify',
                  params: {
                    title: 'Focus sandwich',
                    body: 'Clarify intention and prepare focus task',
                    system: false,
                  },
                },
              ],
            },
          },
          {
            id: 'focus',
            label: 'Deep focus',
            kind: 'focus',
            duration: 'PT25M',
            taskSourceId: 'focus-queue',
            completionPolicy: null,
            notification: {
              sound: 'chime-start',
              systemNotification: true,
            },
            logTarget: null,
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
            handlers: {},
          },
          {
            id: 'cooldown',
            label: 'Cooldown reflection',
            kind: 'cooldown',
            duration: null,
            taskSourceId: 'focus-queue',
            completionPolicy: { kind: 'manualClear' },
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
            handlers: {
              onComplete: [
                {
                  kind: 'script',
                  scriptPath: 'write-back',
                },
              ],
            },
          },
        ],
        transitions: [
          { fromPhaseId: 'warmup', toPhaseId: 'focus', condition: { kind: 'always' } },
          { fromPhaseId: 'focus', toPhaseId: 'cooldown', condition: { kind: 'always' } },
        ],
      },
      'Focus sandwich routine',
      'Hand-authored routine file for focus sandwich workflow.',
    ),
    createNote(
      'focus-sandwich/Warm-Up-Checklist.md',
      {
        type: 'checklist',
        routine: 'focus-sandwich',
      },
      '# Warm-up and intention checklist\n\n- [ ] Silence notifications and close distracting apps\n- [ ] State single priority target for the deep focus phase\n- [ ] Assemble required resources and reference notes\n- [ ] Clear desktop workspace',
    ),
    ...samples.map((s, i) => createNote(
      indexedPath('focus-sandwich', i, s.title),
      {
        type: 'focus-sandwich-task',
        priority: 1,
        due: ANCHOR_DATE.add({ days: s.dueOffsetDays }),
        status: 'todo',
        sessions: 0,
      },
      'Sample task note for focus sandwich routine sessions.',
    )),
  ]
}
