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
| `bun run vault:dev` | Launches sandboxed Obsidian against the testing vault (real display); detaches immediately, hands the shell back. |
| `bun run vault:dev:headless` | Same, under Xvfb -- use for agent-driven verification so no window appears on the real desktop. Blocks until Obsidian exits (required so Xvfb doesn't tear down mid-run) -- run it with a backgrounding tool and send SIGTERM to end it. |
| `bun x openspec` | Runs the OpenSpec CLI (proposal/apply/archive workflow). |

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
