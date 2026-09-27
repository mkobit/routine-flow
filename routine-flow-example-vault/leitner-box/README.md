# Leitner box spaced review

The Leitner box spaced review portfolio demonstrates flashcard reviews organized into spaced repetition boxes.
Reviewing cards triggers grade actions (`Again`, `Hard`, `Good`, `Easy`) that adjust box tiers and set `routine-due` timestamps via `deferDuration`.
Cards deferred into future dates disappear from the review queue and reappear once their scheduled due date arrives.
Card notes in this directory contain frontmatter properties for `box`, `routine-status`, and `routine-due`.
