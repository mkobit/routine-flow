# Obsidian Cadence example vault

This vault is used for development and E2E testing.
Plugin files are installed dynamically into temporary test/dev vault copies by `obsidian-launcher` at runtime and are excluded from git.

## Generated content

The `pomodoro/`, `standup/`, `workout/`, `spaced-repetition/`, `stretch-break/`, `habit-tracking/`, and `chore-list/` folders are generated (not hand-authored, not tracked in git) — one folder per routine in `dev-docs/examples/`.
They're written by `e2e/vault/generator.ts` using `fast-check` with a fixed, deterministic default seed, so content is reproducible across runs and machines.

- E2E runs regenerate them automatically once per run via `e2e/global-setup.ts`.
- For manual dev testing, run `bun scripts/vault-dev.ts --generated` to regenerate before launch.
- Override the seed with `VAULT_SEED=<n>` to reproduce a specific run (e.g. while debugging a flaky test).
