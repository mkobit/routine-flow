import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'bun:test'
import {
  parseManifestSummary,
  parseVersionsMap,
  syncVersionsFiles,
  syncVersionsMap,
} from '../../scripts/release/sync-versions'

describe('sync-versions', () => {
  it('adds or updates the manifest version entry while preserving prior versions', () => {
    const result = syncVersionsMap(
      { '0.0.1': '1.15.1' },
      { version: '0.1.0', minAppVersion: '1.15.1' },
    )
    expect(result.changed).toBe(true)
    expect(result.updated).toEqual({
      '0.0.1': '1.15.1',
      '0.1.0': '1.15.1',
    })
  })

  it('reports unchanged when manifest version already matches minAppVersion', () => {
    const result = syncVersionsMap(
      { '0.0.1': '1.15.1', '0.1.0': '1.15.1' },
      { version: '0.1.0', minAppVersion: '1.15.1' },
    )
    expect(result.changed).toBe(false)
    expect(result.updated).toEqual({
      '0.0.1': '1.15.1',
      '0.1.0': '1.15.1',
    })
  })

  it('validates manifest.json and versions.json payloads', () => {
    expect(() => parseManifestSummary('{"version":"","minAppVersion":"1.15.1"}')).toThrow()
    expect(() => parseVersionsMap('{"0.1.0":123}')).toThrow()
  })

  it('syncs and checks files on disk without modifying during --check', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-versions-'))
    try {
      await fs.writeFile(
        path.join(tmpDir, 'manifest.json'),
        JSON.stringify({ version: '0.2.0', minAppVersion: '1.16.0' }),
        'utf8',
      )
      await fs.writeFile(
        path.join(tmpDir, 'versions.json'),
        JSON.stringify({ '0.1.0': '1.15.1' }),
        'utf8',
      )

      const checkBefore = await syncVersionsFiles(tmpDir, { check: true })
      expect(checkBefore.changed).toBe(true)

      const synced = await syncVersionsFiles(tmpDir)
      expect(synced.changed).toBe(true)

      const written = parseVersionsMap(
        await fs.readFile(path.join(tmpDir, 'versions.json'), 'utf8'),
      )
      expect(written).toEqual({
        '0.1.0': '1.15.1',
        '0.2.0': '1.16.0',
      })

      const checkAfter = await syncVersionsFiles(tmpDir, { check: true })
      expect(checkAfter.changed).toBe(false)
    }
    finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})
