# Routine Flow

This repository contains a customizable routine timer plugin integrated with Obsidian Bases.
It is built with strict TypeScript enforcement.

## Code style and rules

The project enforces strict Functional Programming principles via `eslint`.
- **No mutations**: Use pure reducer functions for state transformations.
- **Dependency separation**: State reducer, state store, and execution tickers live in isolated modules.
- **Dependency Injection**: Inject dispatch handlers and settings instead of binding to global managers.
- **Date/Time**: Use the `Temporal` API for logic instead of the native `Date`.
- **Lint quirk**: `eslint-plugin-obsidianmd`'s sentence-case rule can flag or miss `(e.g. someCamelCase)` parentheticals inconsistently depending on surrounding text — before attributing a new warning to your edit, check it wasn't already present on `main`.
- **Lint FP carve-outs**: `eslint.config.mts` relaxes `functional/no-try-statements`, `functional/no-expression-statements`, and `functional/prefer-immutable-types` across `src/**` so domain code can wrap throwing stdlib/parser APIs (e.g. `JSON.parse`) in try/catch blocks and use expression statements, while maintaining immutability via `functional/immutable-data` and pure state reducers.

## Commands

No CLI is installed globally.
Run devDependency binaries (e.g. `openspec`) via `bun x <name>`, never assume it's on `PATH`.

| Command | Description |
| :--- | :--- |
| `bun run build` | Compiles the plugin using esbuild. |
| `bun test` | Executes unit tests via bun test. |
| `bun run test:e2e` | Runs E2E tests using Playwright. |
| `bun run test:e2e:headless` | Same, under Xvfb -- use for agent-driven verification so no window appears on the real desktop. See `e2e/AGENTS.md` for a WSL crash-dump monitoring caveat before running this. |
| `bun run typecheck` | Type-checks with `tsc --noEmit`. |
| `bun run lint` | Lints with `eslint .`. |
| `bun run docs:dev` | Runs the docs site (`docs/`, a separate Docusaurus project with its own `package.json`/lockfile) locally at http://localhost:3000. Run `bun install` inside `docs/` first. |
| `bun run docs:build` | Builds the docs site to `docs/build/`; also runs as a PR check on changes under `docs/**`. See `docs/AGENTS.md` for sidebar/nav conventions and the docs-specific eslint/bunfig carve-outs. |
| `bun run vault:dev` | Launches sandboxed Obsidian against the testing vault (real display) at 2560x1440; detaches immediately, hands the shell back. Add `-- --theme light` to override the default dark color scheme. |
| `bun run vault:dev:headless` | Same, under Xvfb -- use for agent-driven verification so no window appears on the real desktop. Blocks until Obsidian exits (required so Xvfb doesn't tear down mid-run) -- run it with a backgrounding tool and send SIGTERM to end it. |
| `bun run vault:eval '<js>'` | Evaluates a JS expression in the running `vault:dev` instance via Obsidian's official CLI (no CDP) -- e.g. drive/inspect app state without clicking. |
| `bun run vault:screenshot [path]` | Screenshots the running `vault:dev` window via the same CLI (default `.test-output/vault-screenshot.png`) -- the way to actually see rendered UI when driving Obsidian headlessly or agent-side. |
| `bun run vault:reload` | Copies freshly built `main.js`/`manifest.json`/`styles.css` into the *running* vault's plugin dir and reloads it via CLI, no relaunch needed. Pair with `bun run dev` (esbuild watch). |
| `bun x openspec` | Runs the OpenSpec CLI (proposal/apply/archive workflow). |

`vault:eval`/`vault:screenshot`/`vault:reload` all shell out to `obsidian-cli`, which targets a single globally-active Obsidian instance -- with more than one `vault:dev` running at once (from this repo or a sibling sharing the same obsidian-launcher harness, e.g. bases-chartkit), which instance responds is undefined.

## Design work with Stitch

Stitch is the MCP design tool (`mcp__stitch__*`) for generating UI mockups and design systems.
Use it for UI-facing design work: mocking a new screen or restyling an existing surface before writing any CSS.
Skip it for logic, state, or non-visual changes.

The shared visual language lives in `openspec/changes/design-foundations/DESIGN.md` — semantic state colors, typography, spacing, iconography, all as Obsidian CSS custom-property references, never resolved hex/px.
Per-surface briefs live in `openspec/changes/ui-surface-inventory/design.md` and `surface-model.md`, numbered #1–#12.
Build every Stitch prompt from the surface's brief plus DESIGN.md's vocabulary, so screens stay consistent instead of 12 one-off designs.

### Per-surface workflow

Precedent: the flow-gu1.19 mockup beads (`flow-gu1.19.8`–`.13`).
Read their close reasons via `bd show <id>` before starting a new surface.

1. Reuse the existing Stitch project (id `11876825961275539533`, bootstrapped in flow-gu1.19.7) — don't create a new one.
   Inspect it with `list_projects` / `list_screens` / `get_screen`.
2. Two design systems already exist on it, one per `colorMode`: "Routine Flow — Light" and "Routine Flow — Dark".
   Both were seeded from DESIGN.md via `create_design_system`'s `designMd` field, then applied with `update_design_system`.
   `create_design_system_from_design_md` / `upload_design_md` need an existing screen instance (`selectedScreenInstance`), so on a screen-less project only the structured `create_design_system` path works.
3. Generate the screen with `generate_screen_from_text`, in both light and dark.
   Pull resolved CSS var values from a running instance (`bun run vault:dev` / `vault:dev:headless`) at generation time — DESIGN.md names variables, not values.
   Iterate with `edit_screens` / `generate_variants`; `apply_design_system` re-applies a system to existing screens.
4. Review each mockup against real Obsidian chrome and resolved values, then get Mike's visual sign-off before any implementation.
5. Implement the CSS pass in a separate bead (e.g. flow-gu1.19.18 followed flow-gu1.19.10).

### Caveats (observed, carry forward)

- Stitch invents chrome the real single-panel model doesn't have — an internal tab bar (Focus/Queue/Stats/Settings), a bottom transport bar, an "Add task to queue" button (the queue is a live Bases query, `src/timer/base-query-task-source.ts`, not manually editable).
  Disregard these uniformly; they're generation artifacts, not design direction.
- Stitch can't see Obsidian's actual CSS values or native button styling.
  Describe them explicitly in the prompt (e.g. spell out the destructive-button look, per flow-gu1.19.11) instead of referencing "Obsidian's own styling".
- No raster imagery, ever (DESIGN.md) — redesign any raster-style graphic a mockup invents (a rendered ring, an illustration) as inline SVG or CSS during implementation.
- Design-system color/font seeds (e.g. `#7C3AED`, INTER) are Stitch approximations, labeled as such in the `designMd` — not claims about real Obsidian values.
- The first call in a session may fail with an "incompatible auth server" error that clears on retry — treat as transient unless it recurs.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ccf33ec3 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until it's merged into `main` on the remote.

**`main` is branch-protected** — GitHub rejects direct pushes to it ("Changes must be made through a pull request"). Code/doc changes MUST go through a branch + PR, not `git push` to main directly. `bd dolt push` is unaffected — it targets a separate ref (`refs/dolt/data`), not `main`, so push it directly as usual.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUBLISH TO REMOTE** - This is MANDATORY:
   ```bash
   bd dolt push                                    # beads data — direct push is fine, separate ref
   git checkout -b <branch-name>                   # if not already on a feature branch
   git push -u origin <branch-name>
   gh pr create --title "..." --body "..."
   gh pr checks <pr-number> --watch --fail-fast     # wait for CI, don't sleep-poll manually
   gh pr merge <pr-number> --squash --delete-branch
   git checkout main && git pull
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches, delete merged local branches
6. **Verify** - All changes committed AND merged into main on the remote
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until the PR is merged into `main` on the remote
- NEVER stop before merging - that leaves work stranded on a branch or local-only
- NEVER say "ready to merge when you are" - YOU must open, watch, and merge the PR
- A rejected direct push to main is expected, not an error to force past — open a PR instead
- If a CI check fails, investigate before retrying; a bare re-run is only appropriate for a check already known to be flaky (e.g. flow-gu1.18)
<!-- END BEADS INTEGRATION -->
