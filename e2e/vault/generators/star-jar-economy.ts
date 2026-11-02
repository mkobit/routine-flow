import fc from 'fast-check'
import { createNote } from '../note'
import { indexedPath, routineFileNote, routineReadme } from '../routine-note'
import type { NoteDefinition } from '../schema'

const STAR_JAR_TASKS = [
  {
    title: 'Fix typo in API reference documentation',
    description: 'Quick documentation cleanup task worth a single star.',
    fixedStars: 1,
  },
  {
    title: 'Update unit tests for date formatting',
    description: 'Small test coverage improvement across edge-case date boundaries.',
    fixedStars: 2,
  },
  {
    title: 'Refactor queue badge projection helper',
    description: 'Medium-sized refactoring to keep queue badge rendering pure and isolated.',
    fixedStars: 3,
  },
  {
    title: 'Implement stateful reward accumulator hook',
    description: 'Deep engineering task implementing frontmatter reward bank mutations.',
    fixedStars: 5,
  },
  {
    title: 'Review pull request for formula evaluator',
    description: 'Code review verifying member access expressions in transition guards.',
    fixedStars: null,
  },
  {
    title: 'Design end-to-end reward economy test suite',
    description: 'Comprehensive integration test suite exercising star accumulation and reset.',
    fixedStars: 5,
  },
] as const

const STAR_VALUES = [1, 2, 3, 5] as const
const TASK_CATEGORIES = ['documentation', 'testing', 'refactoring', 'engineering'] as const

export function generateStarJarEconomyNotes(seed: number): readonly NoteDefinition[] {
  const taskArb = fc.record({
    stars: fc.constantFrom(...STAR_VALUES),
    category: fc.constantFrom(...TASK_CATEGORIES),
    priority: fc.integer({ min: 1, max: 4 }),
  })
  const samples = fc.sample(taskArb, { numRuns: STAR_JAR_TASKS.length, seed })

  return [
    routineReadme(
      'star-jar-economy',
      'The star-jar-economy routine demonstrates a token economy where completing sized tasks accumulates stars in a shared point bank note (`Star-Jar-Tracker.md`).\nWhen the accumulated star balance reaches the 15-star milestone (`tracker.stars >= 15`), the routine transitions into a 30-minute prize celebration break and resets the star bank upon exit.',
    ),
    routineFileNote(
      'star-jar-economy',
      'star-jar-routine.md',
      {
        id: 'star-jar',
        name: 'Star jar reward routine',
        trackerFilePath: 'star-jar-economy/Star-Jar-Tracker.md',
        phases: [
          {
            id: 'focus',
            label: 'Focus session',
            kind: 'focus',
            duration: 'PT25M',
            taskSourceId: 'star-tasks',
            logTarget: {
              kind: 'activeItem',
            },
            badges: [
              {
                property: 'stars',
                label: 'Stars',
                icon: 'star',
                variant: 'accent',
              },
            ],
            handlers: {
              onComplete: [
                {
                  kind: 'preset',
                  preset: 'accumulateReward',
                },
              ],
            },
            onCompletion: 'waitForManual',
          },
          {
            id: 'short-break',
            label: 'Short break',
            kind: 'break',
            duration: 'PT5M',
            onCompletion: 'autoAdvance',
          },
          {
            id: 'prize-break',
            label: 'Prize celebration break',
            kind: 'break',
            duration: 'PT30M',
            onCompletion: 'autoAdvance',
            handlers: {
              onExit: [
                {
                  kind: 'preset',
                  preset: 'resetReward',
                },
              ],
            },
          },
        ],
        transitions: [
          {
            from: 'focus',
            to: 'prize-break',
            guard: {
              kind: 'custom',
              predicate: 'star-jar-full',
            },
          },
          {
            from: 'focus',
            to: 'short-break',
            guard: {
              kind: 'always',
            },
          },
          {
            from: 'short-break',
            to: 'focus',
            guard: {
              kind: 'always',
            },
          },
          {
            from: 'prize-break',
            to: 'focus',
            guard: {
              kind: 'always',
            },
          },
        ],
      },
      'Star jar reward routine',
      'Stateful token economy routine that accumulates task stars into a tracker note and branches to a prize celebration break at 15 stars.',
    ),
    createNote(
      'star-jar-economy/Star-Jar-Tracker.md',
      {
        stars: 0,
        target: 15,
      },
      '# Star jar point bank\n\nCurrent accumulated stars toward reward milestone.',
    ),
    ...STAR_JAR_TASKS.map((task, index) => {
      const sample = samples[index]
      const stars = task.fixedStars ?? sample?.stars ?? 3
      const category = sample?.category ?? TASK_CATEGORIES[index % TASK_CATEGORIES.length] ?? 'engineering'
      const priority = sample?.priority ?? ((index % 3) + 1)

      return createNote(
        indexedPath('star-jar-economy', index, task.title),
        {
          stars,
          category,
          status: 'pending',
          priority,
        },
        `# ${task.title}\n\n${task.description}`,
      )
    }),
  ]
}
