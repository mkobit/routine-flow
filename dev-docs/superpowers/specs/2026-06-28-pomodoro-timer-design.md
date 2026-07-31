# Pomodoro timer plugin design

This document describes the architecture and design of the Obsidian Pomodoro timer plugin.
The plugin provides a customizable timer workflow that integrates with Obsidian Bases.

## Core requirements

The plugin will provide a customizable timer engine.
It will run a background state machine to track sessions.
It will integrate with Obsidian Bases by providing a custom view.
It will list task notes fetched by a Base query as a work queue.
It will support writing session data back to the task note's frontmatter properties.
All tooling and configuration will be bootstrapped from the `obsidian-bases-charts` repository.

## Architecture and primitives

We use Zod to validate configurations and runtime states.

### Configuration schemas

```typescript
import { z } from 'zod';

export const PhaseConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  durationSeconds: z.number().int().positive(),
  type: z.enum(['focus', 'break', 'custom']).default('custom'),
});

export const WorkflowConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  phases: z.array(PhaseConfigSchema).nonempty(),
  loop: z.boolean().default(true),
});
```

### Runtime state schema

```typescript
export const TimerStateSchema = z.object({
  status: z.enum(['running', 'paused', 'stopped']),
  workflowId: z.string(),
  currentPhaseIndex: z.number().int().nonnegative(),
  remainingSeconds: z.number().int().nonnegative(),
  activeFilePath: z.string().nullable(),
});
```

### State transitions

The `TimerManager` manages the active timer state.
It decrements `remainingSeconds` using a periodic timer when running.
When `remainingSeconds` reaches zero, it automatically advances to the next phase in the active workflow.
If the workflow is configured to loop, it wraps around to the first phase after completing the last phase.
Users can manually pause, resume, skip, or reset the active timer state.

## Bases integration

The plugin registers a custom Bases view named `pomodoro-timer`.
The view renders the current active timer state at the top.
The view displays a list of entries returned by the active Base query.
Clicking an entry in the list sets it as the active timer target.

## File write-back

On focus phase completion, the plugin updates the frontmatter of the active note.
It retrieves the note via the vault API using the active file path.
It uses `processFrontMatter` to safely modify properties.
It increments a user-configured counter property or logs the session duration.
This update triggers Obsidian to re-index the note and update the active Base.

## Development tooling

The plugin environment uses Bun for dependencies and script execution.
It uses Husky and lint-staged for git hooks.
It runs unit tests via Bun test.
It runs end-to-end tests using Playwright.
The build is compiled using Esbuild.
It uses Release-Please to manage version releases.

## GitHub repository policies

The repository must follow these rules:
1. Require branch merges via Pull Requests only.
2. Only squash merges are allowed.
3. Prevent force pushing to the main branch.
