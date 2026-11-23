#!/usr/bin/env bun
// Evaluate JS in the running `vault:dev` Obsidian via Obsidian's official CLI
// (https://obsidian.md/help/cli). Usage: bun scripts/vault/eval.ts '<js expression>'
//
// Code must be an expression that evaluates to (or returns) the value you
// want, e.g. `app.vault.getFiles().length` or `app.vault.read(someFile)`.
// The CLI awaits a returned promise for you, but a bare `await` keyword
// isn't valid here -- it runs as a classic `eval()`, not inside an async
// function -- so pass the promise-returning expression itself, not an
// `await`-prefixed one.
// Ported from bases-chartkit's scripts/vault-eval.ts.

import { Command } from 'commander'
import { runCli, runObsidianCli } from './shared'

async function runEval(code: string): Promise<void> {
  const { stdout, stderr, exitCode } = await runObsidianCli(['eval', `code=${code}`])
  if (exitCode !== 0) {
    console.error(stderr || 'obsidian-cli eval failed — is `bun run vault:dev` running?')
    process.exit(exitCode)
  }
  console.log(stdout)
}

const program = new Command()
  .name('vault-eval')
  .description('Evaluate JS in the running `vault:dev` Obsidian via Obsidian\'s official CLI.')
  .argument('<code>', 'JS expression to evaluate (e.g. app.vault.getName())')
  .action(runEval)

runCli('vault-eval', () => program.parseAsync())
