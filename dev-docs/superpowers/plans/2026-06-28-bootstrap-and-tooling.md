# Bootstrap and tooling implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the plugin's source code, build system, and configuration files from the `obsidian-bases-charts` repository.

**Architecture:** We copy the configuration, tooling, and test pipelines from the existing `obsidian-bases-charts` repository.
We clean up chart-specific source code and test files.
We update the metadata, name, and repository references to establish a clean skeleton for the new Pomodoro plugin.

**Tech Stack:** Bun, TypeScript, Esbuild, ESLint, Playwright, Husky, Mise, Release-Please.

---

### Task 1: Environment and configuration files setup

**Files:**
- Create: `.bunfig.toml`
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `.lintstagedrc.yml`
- Create: `.nvmrc`
- Create: `mise.toml`
- Create: `mise.lock`
- Create: `.jules/env_setup.sh`
- Create: `.husky/pre-commit`
- Create: `release-please-config.json`
- Create: `.release-please-manifest.json`

- [ ] **Step 1: Copy environment and setup files from template**

Run the following copy command to replicate standard project environment configurations:
```bash
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/.bunfig.toml .
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/.editorconfig .
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/.gitignore .
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/.lintstagedrc.yml .
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/.nvmrc .
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/mise.toml .
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/mise.lock .
mkdir -p .jules
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/.jules/env_setup.sh .jules/
mkdir -p .husky
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/.husky/pre-commit .husky/
```

- [ ] **Step 2: Copy release-please configuration files**

Run the copy command for release management files:
```bash
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/release-please-config.json .
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/.release-please-manifest.json .
```

- [ ] **Step 3: Update release-please-config.json with correct repository**

Edit `release-please-config.json` to replace all `obsidian-bases-charts` strings with `obsidian-pomodoro-plugin`.
Expected: `release-please-config.json` contains correct references.

- [ ] **Step 4: Commit configuration files**

Run:
```bash
git add .bunfig.toml .editorconfig .gitignore .lintstagedrc.yml .nvmrc mise.toml mise.lock .jules/env_setup.sh .husky/pre-commit release-please-config.json .release-please-manifest.json
git commit -m "chore: copy project configuration files from template"
```

---

### Task 2: Package and manifest configuration

**Files:**
- Create: `package.json`
- Create: `manifest.json`

- [ ] **Step 1: Write package.json**

Create a clean `package.json` containing the required dependencies, excluding ECharts:
```json
{
  "name": "obsidian-pomodoro-plugin",
  "version": "0.0.1",
  "description": "Customizable Pomodoro timer with Obsidian Bases support.",
  "main": "main.js",
  "type": "module",
  "scripts": {
    "build": "bun esbuild.config.mjs production",
    "dev": "bun esbuild.config.mjs",
    "lint": "eslint .",
    "prepare": "husky",
    "test": "bun test ./tests",
    "test:coverage": "bun test ./tests --coverage --coverage-reporter=lcov",
    "test:e2e": "bun x playwright test",
    "typecheck": "tsc --noEmit",
    "vault:dev": "bun scripts/vault-dev.ts",
    "vault:install": "bun scripts/vault-install.ts",
    "vault:sync": "bun scripts/vault-sync.ts"
  },
  "keywords": [],
  "license": "MIT",
  "devDependencies": {
    "@eslint/compat": "^2.1.0",
    "@eslint/core": "^1.2.1",
    "@eslint/js": "^10.0.1",
    "@eslint/json": "^2.0.0",
    "@playwright/test": "^1.60.0",
    "@stylistic/eslint-plugin": "^5.10.0",
    "@types/bun": "^1.3.14",
    "@types/node": "^25.9.2",
    "commander": "^15.0.0",
    "esbuild": "0.28.0",
    "eslint": "^10",
    "eslint-plugin-functional": "^10.0.0",
    "eslint-plugin-obsidianmd": "^0.3.0",
    "eslint-plugin-promise": "^7.3.0",
    "eslint-plugin-unicorn": "^65.0.1",
    "eslint-plugin-yml": "^3.4.0",
    "fast-check": "^4.8.0",
    "globals": "17.6.0",
    "husky": "^9.1.7",
    "jiti": "^2.7.0",
    "lint-staged": "^17.0.7",
    "obsidian-launcher": "^3.0.4",
    "ts-node": "^10.9.2",
    "tsc-files": "^1.1.4",
    "tslib": "2.8.1",
    "typescript": "^6.0.3",
    "typescript-eslint": "^8.60.1"
  },
  "dependencies": {
    "i18next": "^26.3.1",
    "obsidian": "1.11.4",
    "remeda": "^2.37.0",
    "temporal-polyfill": "^0.3.2",
    "zod": "^4.4.3"
  }
}
```

- [ ] **Step 2: Write manifest.json**

Create `manifest.json`:
```json
{
  "id": "obsidian-pomodoro-plugin",
  "name": "Bases Pomodoro",
  "version": "0.0.1",
  "minAppVersion": "1.10.0",
  "description": "Customizable Pomodoro timer with Obsidian Bases support.",
  "author": "mkobit",
  "authorUrl": "https://github.com/mkobit",
  "isDesktopOnly": true
}
```

- [ ] **Step 3: Commit files**

Run:
```bash
git add package.json manifest.json
git commit -m "chore: add package.json and manifest.json"
```

---

### Task 3: Build scripts and build config

**Files:**
- Create: `esbuild.config.mjs`
- Create: `eslint.config.mts`
- Create: `tsconfig.json`
- Create: `styles.css`
- Create: `scripts/vault-dev.ts`
- Create: `scripts/vault-install.ts`
- Create: `scripts/vault-sync.ts`

- [ ] **Step 1: Copy and adjust build configuration files**

Run:
```bash
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/esbuild.config.mjs .
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/eslint.config.mts .
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/tsconfig.json .
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/styles.css .
mkdir -p scripts
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/scripts/vault-dev.ts scripts/
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/scripts/vault-install.ts scripts/
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/scripts/vault-sync.ts scripts/
```

- [ ] **Step 2: Update scripts to reference the new plugin ID**

Edit `scripts/vault-dev.ts`, `scripts/vault-install.ts`, and `scripts/vault-sync.ts` to replace `obsidian-bases-charts` with `obsidian-pomodoro-plugin`.
Expected: Script references point to the new plugin.

- [ ] **Step 3: Commit build configurations**

Run:
```bash
git add esbuild.config.mjs eslint.config.mts tsconfig.json styles.css scripts/
git commit -m "chore: add build and sync configurations"
```

---

### Task 4: Source skeleton setup

**Files:**
- Create: `src/main.ts`
- Create: `src/settings.ts`
- Create: `src/lang/i18n.ts`
- Create: `src/lang/text.ts`

- [ ] **Step 1: Write settings schema and default settings**

Create `src/settings.ts`:
```typescript
import { z } from 'zod';

export const PomodoroSettingsSchema = z.object({
  writeBackProperty: z.string().default('pomodoros'),
  defaultWorkDurationSeconds: z.number().int().positive().default(1500),
  defaultBreakDurationSeconds: z.number().int().positive().default(300),
});

export type PomodoroSettings = z.infer<typeof PomodoroSettingsSchema>;

export const DEFAULT_SETTINGS: PomodoroSettings = {
  writeBackProperty: 'pomodoros',
  defaultWorkDurationSeconds: 1500,
  defaultBreakDurationSeconds: 300,
};
```

- [ ] **Step 2: Write minimal main plugin class**

Create `src/main.ts`:
```typescript
import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type PomodoroSettings } from './settings';

export default class PomodoroPlugin extends Plugin {
  public settings: PomodoroSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    console.log('Pomodoro Plugin loaded successfully');
  }

  onunload() {
    console.log('Pomodoro Plugin unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData() as Partial<PomodoroSettings>,
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
```

- [ ] **Step 3: Commit source skeleton**

Run:
```bash
git add src/
git commit -m "feat: add minimal source skeleton"
```

---

### Task 5: Testing environment and E2E setup

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.e2e.ts`
- Create: `e2e/fixtures/obsidian.ts`
- Create: `e2e/helpers/evaluate.ts`
- Create: `e2e/obsidian-internal.d.ts`
- Create: `e2e/vault/`
- Create: `tests/dummy.test.ts`

- [ ] **Step 1: Replicate testing directories**

Run:
```bash
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/playwright.config.ts .
mkdir -p e2e/fixtures e2e/helpers e2e/vault
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/e2e/fixtures/obsidian.ts e2e/fixtures/
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/e2e/helpers/evaluate.ts e2e/helpers/
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/e2e/obsidian-internal.d.ts e2e/
```

- [ ] **Step 2: Create a basic E2E vault config**

Copy the testing vault configuration:
```bash
cp -r /home/mkobit/workspace/mkobit/obsidian-bases-charts/e2e/vault/ e2e/
```

- [ ] **Step 3: Create smoke.e2e.ts**

Create `e2e/smoke.e2e.ts`:
```typescript
import { test, expect } from './fixtures/obsidian';
import { evaluateObsidian } from './helpers/evaluate';

const PLUGIN_ID = 'obsidian-pomodoro-plugin';

test.describe('plugin lifecycle', () => {
  test('loads into the plugin registry', async ({ obsidianPage: { page } }) => {
    await expect.poll(async () =>
      evaluateObsidian(
        page,
        (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
        { pluginId: PLUGIN_ID },
      ),
    ).toBe(true);
  });
});
```

- [ ] **Step 4: Create dummy unit test**

Create `tests/dummy.test.ts` to verify unit test script execution:
```typescript
import { expect, test } from 'bun:test';

test('skeleton project test', () => {
  expect(true).toBe(true);
});
```

- [ ] **Step 5: Install dependencies and compile project**

Run:
```bash
bun install
bun run build
```

- [ ] **Step 6: Run verification tests**

Run unit tests:
```bash
bun run test
```
Expected: Tests pass.

Run E2E smoke tests:
```bash
bun run test:e2e
```
Expected: Playwright tests pass.

- [ ] **Step 7: Commit test configuration**

Run:
```bash
git add playwright.config.ts e2e/ tests/ bun.lock
git commit -m "test: set up unit and e2e testing infrastructure"
```

---

### Task 6: GitHub Actions configuration

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/pr-title.yml`
- Create: `.github/workflows/release-please.yml`
- Create: `.github/workflows/release.yml`
- Create: `.github/actions/setup-env/action.yml`

- [ ] **Step 1: Replicate workflow directory**

Run:
```bash
mkdir -p .github/workflows .github/actions/setup-env
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/.github/workflows/ci.yml .github/workflows/
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/.github/workflows/pr-title.yml .github/workflows/
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/.github/workflows/release-please.yml .github/workflows/
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/.github/workflows/release.yml .github/workflows/
cp /home/mkobit/workspace/mkobit/obsidian-bases-charts/.github/actions/setup-env/action.yml .github/actions/setup-env/
```

- [ ] **Step 2: Update workflows for new repository**

Edit `.github/workflows/ci.yml` and replace references to `obsidian-bases-charts` with `obsidian-pomodoro-plugin`.
Expected: Workflow targets the new repository.

- [ ] **Step 3: Commit workflow files**

Run:
```bash
git add .github/
git commit -m "chore: set up github actions workflows"
```

---

### Task 7: Branch protection rules description

- [ ] **Step 1: Document requested GitHub settings**

We verify that the repository requires branch merges via Pull Request.
We verify that force pushes to the main branch are prohibited.
We verify that only squash merges are allowed.
Add this policy instruction to `docs/superpowers/specs/2026-06-28-pomodoro-timer-design.md` as an append action:
```markdown

## GitHub repository policies

The repository must follow these rules:
1. Require branch merges via Pull Requests only.
2. Only squash merges are supported.
3. Prevent force pushing to the main branch.
```

- [ ] **Step 2: Commit policy update**

Run:
```bash
git add docs/superpowers/specs/2026-06-28-pomodoro-timer-design.md
git commit -m "docs: document github repository policies"
```
