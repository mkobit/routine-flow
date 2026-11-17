# GitHub Actions workflows

This directory stores the CI, release, documentation, and validation workflows, plus the dependency lockfile [actions.lock](actions.lock).

## Lockfile maintenance

Install the pinned CLI extension before you update or verify workflow dependencies:

```bash
gh extension install github/gh-actions-lock --pin v0.4.0
```

Refresh or onboard workflow action pins (migrating local `./` action references to `$/`):

```bash
gh actions-lock --migrate-local-actions
```

Re-resolve all tracked refs to their current upstream commits:

```bash
gh actions-lock --relock
```

## Verification

Run the same strict check that CI runs:

```bash
gh actions-lock --verify
```

Run an offline coverage check without network calls:

```bash
gh actions-lock --verify-local
```
