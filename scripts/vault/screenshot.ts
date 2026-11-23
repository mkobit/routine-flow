#!/usr/bin/env bun
// Capture a screenshot of the running `vault:dev` Obsidian window via
// Obsidian's official CLI (https://obsidian.md/help/cli).
// Usage: bun scripts/vault/screenshot.ts [output-path]
// Default output: ./.test-output/vault-screenshot.png
// Ported from bases-chartkit's scripts/vault-screenshot.ts.

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { Command } from 'commander'
import { runCli, runObsidianCli } from './shared'

const DEFAULT_OUTPUT = path.join('.test-output', 'vault-screenshot.png')

async function runScreenshot(rawOutputPath: string): Promise<void> {
  const outputPath = path.resolve(rawOutputPath)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  const { stderr, exitCode } = await runObsidianCli(['dev:screenshot', `path=${outputPath}`])
  if (exitCode !== 0) {
    console.error(stderr || 'obsidian-cli dev:screenshot failed — is `bun run vault:dev` running?')
    process.exit(exitCode)
  }
  const { size } = await fs.stat(outputPath)
  console.log(`Screenshot written: ${outputPath} (${size} bytes)`)
}

const program = new Command()
  .name('vault-screenshot')
  .description('Capture a screenshot of the running `vault:dev` Obsidian window via Obsidian\'s official CLI.')
  .argument('[output-path]', 'path to write the PNG screenshot', DEFAULT_OUTPUT)
  .action(runScreenshot)

runCli('vault-screenshot', () => program.parseAsync())
