#!/usr/bin/env bun
// Usage: bun run release:sync-versions [--check]
// Keeps versions.json aligned with manifest.json version and minAppVersion.

import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export interface ManifestSummary {
  readonly version: string
  readonly minAppVersion: string
}

export type VersionsMap = Readonly<Record<string, string>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parses and validates the version fields required from `manifest.json`.
 */
export function parseManifestSummary(raw: string): ManifestSummary {
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed)) {
    throw new TypeError('manifest.json must contain a JSON object')
  }
  const { version, minAppVersion } = parsed
  if (typeof version !== 'string' || version.length === 0) {
    throw new TypeError('manifest.json must contain a non-empty string "version"')
  }
  if (typeof minAppVersion !== 'string' || minAppVersion.length === 0) {
    throw new TypeError('manifest.json must contain a non-empty string "minAppVersion"')
  }
  return { version, minAppVersion }
}

/**
 * Parses and validates `versions.json` as a string-to-string map.
 */
export function parseVersionsMap(raw: string): VersionsMap {
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed)) {
    throw new TypeError('versions.json must contain a JSON object')
  }
  const validatedEntries: Array<readonly [string, string]> = []
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError(`versions.json entry "${key}" must be a non-empty string`)
    }
    validatedEntries.push([key, value])
  }
  return Object.fromEntries(validatedEntries)
}

/**
 * Returns an updated `versions.json` map with `manifest.version` mapped to `manifest.minAppVersion`.
 */
export function syncVersionsMap(
  versions: VersionsMap,
  manifest: ManifestSummary,
): { readonly updated: VersionsMap, readonly changed: boolean } {
  const existing = versions[manifest.version]
  if (existing === manifest.minAppVersion) {
    return { updated: versions, changed: false }
  }
  return {
    updated: {
      ...versions,
      [manifest.version]: manifest.minAppVersion,
    },
    changed: true,
  }
}

/**
 * Synchronizes `versions.json` on disk against `manifest.json`, or checks that it is already in sync.
 */
export async function syncVersionsFiles(
  rootDir: string,
  options: { readonly check?: boolean } = {},
): Promise<{ readonly changed: boolean, readonly manifest: ManifestSummary }> {
  const manifestPath = path.join(rootDir, 'manifest.json')
  const versionsPath = path.join(rootDir, 'versions.json')

  const [manifestRaw, versionsRaw] = await Promise.all([
    fs.readFile(manifestPath, 'utf8'),
    fs.readFile(versionsPath, 'utf8'),
  ])

  const manifest = parseManifestSummary(manifestRaw)
  const versions = parseVersionsMap(versionsRaw)
  const { updated, changed } = syncVersionsMap(versions, manifest)

  if (changed && !options.check) {
    await fs.writeFile(versionsPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8')
  }

  return { changed, manifest }
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check')
  const rootDir = path.resolve(import.meta.dir, '../..')
  const { changed, manifest } = await syncVersionsFiles(rootDir, { check })
  if (check && changed) {
    console.error(
      `versions.json is out of sync with manifest.json (${manifest.version}: ${manifest.minAppVersion}). Run "bun run release:sync-versions".`,
    )
    process.exit(1)
  }
  if (changed) {
    console.log(`Updated versions.json with ${manifest.version}: ${manifest.minAppVersion}`)
  }
  else {
    console.log(`versions.json is in sync (${manifest.version}: ${manifest.minAppVersion})`)
  }
}

if (import.meta.main) {
  void main()
}
