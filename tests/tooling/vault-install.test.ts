import { describe, expect, it, mock } from 'bun:test'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import {
  enableCommunityPlugin,
  getObsidianConfigPath,
  installToVault,
  parseInstallOptions,
  resolveVaultPath,
} from '../../scripts/vault/install'
import { PLUGIN_ARTIFACTS, PLUGIN_ID } from '../../scripts/vault/shared'

async function expectRejects(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await promise
    expect.unreachable('Expected promise to reject')
  }
  catch (err) {
    expect(err).toBeInstanceOf(Error)
    if (err instanceof Error) {
      expect(err.message).toMatch(pattern)
    }
  }
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'vault-install-test-'))
  try {
    return await fn(dir)
  }
  finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

describe('parseInstallOptions', () => {
  it('defaults build to true, enable and reload to false, and vault to undefined', () => {
    expect(parseInstallOptions([])).toEqual({
      build: true,
      enable: false,
      reload: false,
    })
  })

  it('supports --no-build, --build, --vault, --enable, and --reload', () => {
    expect(parseInstallOptions([
      '--vault',
      'MyVault',
      '--no-build',
      '--enable',
      '--reload',
    ])).toEqual({
      vault: 'MyVault',
      build: false,
      enable: true,
      reload: true,
    })

    expect(parseInstallOptions(['--build']).build).toBe(true)
  })
})

describe('getObsidianConfigPath', () => {
  it('resolves Linux, macOS, and Windows paths', () => {
    expect(getObsidianConfigPath('linux', {}, '/home/alice')).toBe(
      path.join('/home/alice', '.config', 'obsidian', 'obsidian.json'),
    )
    expect(getObsidianConfigPath('linux', { XDG_CONFIG_HOME: '/custom/cfg' }, '/home/alice')).toBe(
      path.join('/custom/cfg', 'obsidian', 'obsidian.json'),
    )
    expect(getObsidianConfigPath('darwin', {}, '/Users/alice')).toBe(
      path.join('/Users/alice', 'Library', 'Application Support', 'obsidian', 'obsidian.json'),
    )
    expect(getObsidianConfigPath('win32', { APPDATA: 'C:\\Users\\alice\\AppData\\Roaming' }, 'C:\\Users\\alice')).toBe(
      path.join('C:\\Users\\alice\\AppData\\Roaming', 'obsidian', 'obsidian.json'),
    )
  })
})

describe('resolveVaultPath', () => {
  it('uses an existing directory path directly without consulting obsidian.json', async () => {
    await withTempDir(async (dir) => {
      const vaultDir = path.join(dir, 'DirectVault')
      await fs.mkdir(vaultDir, { recursive: true })
      const missingConfig = path.join(dir, 'nonexistent-obsidian.json')

      expect(await resolveVaultPath(vaultDir, missingConfig)).toBe(vaultDir)
    })
  })

  it('resolves a vault by name from obsidian.json', async () => {
    await withTempDir(async (dir) => {
      const configPath = path.join(dir, 'obsidian.json')
      await fs.writeFile(configPath, JSON.stringify({
        vaults: {
          v1: { path: '/vaults/Work', ts: 1 },
          v2: { path: '/vaults/Personal', ts: 2 },
        },
      }))

      expect(await resolveVaultPath('Work', configPath)).toBe('/vaults/Work')
    })
  })

  it('picks the only vault when --vault is omitted', async () => {
    await withTempDir(async (dir) => {
      const configPath = path.join(dir, 'obsidian.json')
      await fs.writeFile(configPath, JSON.stringify({
        vaults: {
          v1: { path: '/vaults/Solo', ts: 1 },
        },
      }))

      expect(await resolveVaultPath(undefined, configPath)).toBe('/vaults/Solo')
    })
  })

  it('picks the single open vault when --vault is omitted and multiple vaults exist', async () => {
    await withTempDir(async (dir) => {
      const configPath = path.join(dir, 'obsidian.json')
      await fs.writeFile(configPath, JSON.stringify({
        vaults: {
          v1: { path: '/vaults/Work', ts: 1, open: false },
          v2: { path: '/vaults/Personal', ts: 2, open: true },
        },
      }))

      expect(await resolveVaultPath(undefined, configPath)).toBe('/vaults/Personal')
    })
  })

  it('fails with a clear list of available vaults when --vault is omitted and selection is ambiguous', async () => {
    await withTempDir(async (dir) => {
      const configPath = path.join(dir, 'obsidian.json')
      await fs.writeFile(configPath, JSON.stringify({
        vaults: {
          v1: { path: '/vaults/Work', ts: 1 },
          v2: { path: '/vaults/Personal', ts: 2 },
        },
      }))

      await expectRejects(resolveVaultPath(undefined, configPath), /Work.*\/vaults\/Work/)
      await expectRejects(resolveVaultPath(undefined, configPath), /Personal.*\/vaults\/Personal/)
    })
  })

  it('fails with a clear list when a named vault is not found or duplicated', async () => {
    await withTempDir(async (dir) => {
      const configPath = path.join(dir, 'obsidian.json')
      await fs.writeFile(configPath, JSON.stringify({
        vaults: {
          v1: { path: '/a/Notes', ts: 1 },
          v2: { path: '/b/Notes', ts: 2 },
        },
      }))

      await expectRejects(resolveVaultPath('Missing', configPath), /Available vaults:/)
      await expectRejects(resolveVaultPath('Notes', configPath), /Multiple vaults named "Notes"/)
    })
  })
})

describe('enableCommunityPlugin', () => {
  it('creates community-plugins.json when missing and preserves existing entries without duplicates', async () => {
    await withTempDir(async (dir) => {
      const obsidianDir = path.join(dir, '.obsidian')
      await fs.mkdir(obsidianDir, { recursive: true })
      const communityPluginsPath = path.join(obsidianDir, 'community-plugins.json')

      expect(await enableCommunityPlugin(dir)).toBe(true)
      expect(JSON.parse(await fs.readFile(communityPluginsPath, 'utf8'))).toEqual([PLUGIN_ID])

      await fs.writeFile(communityPluginsPath, JSON.stringify(['dataview', 'templater'], null, 2))
      expect(await enableCommunityPlugin(dir)).toBe(true)
      expect(JSON.parse(await fs.readFile(communityPluginsPath, 'utf8'))).toEqual([
        'dataview',
        'templater',
        PLUGIN_ID,
      ])

      expect(await enableCommunityPlugin(dir)).toBe(false)
      expect(JSON.parse(await fs.readFile(communityPluginsPath, 'utf8'))).toEqual([
        'dataview',
        'templater',
        PLUGIN_ID,
      ])
    })
  })
})

describe('installToVault', () => {
  it('rejects a directory without .obsidian without writing any files', async () => {
    await withTempDir(async (dir) => {
      const nonVault = path.join(dir, 'not-a-vault')
      await fs.mkdir(nonVault, { recursive: true })

      await expectRejects(installToVault(
        { vault: nonVault, build: false, enable: true, reload: false },
        {
          assertArtifactsFn: async () => {},
          copyFn: async () => {
            throw new Error('copyFn should not be called for non-vault')
          },
        },
      ), /missing \.obsidian directory/)

      expect(existsSync(path.join(nonVault, '.obsidian'))).toBe(false)
    })
  })

  it('installs only PLUGIN_ARTIFACTS non-destructively and supports --enable and --reload', async () => {
    await withTempDir(async (dir) => {
      const fakeRepo = path.join(dir, 'repo')
      const vaultDir = path.join(dir, 'vault')
      const notePath = path.join(vaultDir, 'Daily Note.md')
      const otherPluginFile = path.join(vaultDir, '.obsidian', 'plugins', 'other-plugin', 'main.js')

      await fs.mkdir(fakeRepo, { recursive: true })
      await fs.mkdir(path.dirname(otherPluginFile), { recursive: true })
      await fs.writeFile(notePath, '# Keep my notes')
      await fs.writeFile(otherPluginFile, 'console.log("other")')
      await Promise.all(PLUGIN_ARTIFACTS.map(file =>
        fs.writeFile(path.join(fakeRepo, file), `artifact:${file}`)))
      await fs.writeFile(path.join(fakeRepo, 'extra-ignored.txt'), 'do not copy')

      const buildFn = mock(async () => {})
      const assertArtifactsFn = mock(async () => {})
      const copyFn = mock(async (pluginDir: string) => {
        await fs.mkdir(pluginDir, { recursive: true })
        await Promise.all(PLUGIN_ARTIFACTS.map(file =>
          fs.cp(path.join(fakeRepo, file), path.join(pluginDir, file))))
      })
      const reloadFn = mock(async () => ({ stdout: 'Reloaded', stderr: '', exitCode: 0 }))

      const result = await installToVault(
        { vault: vaultDir, build: true, enable: true, reload: true },
        {
          buildFn,
          assertArtifactsFn,
          copyFn,
          reloadFn,
        },
      )

      expect(buildFn).toHaveBeenCalledTimes(1)
      expect(assertArtifactsFn).toHaveBeenCalledTimes(1)
      expect(copyFn).toHaveBeenCalledTimes(1)
      expect(reloadFn).toHaveBeenCalledTimes(1)
      expect(result.vaultPath).toBe(vaultDir)
      expect(result.enabled).toBe(true)
      expect(result.reloaded).toBe(true)

      const installedFiles = await fs.readdir(result.pluginDir)
      expect([...installedFiles].sort()).toEqual([...PLUGIN_ARTIFACTS].sort())
      expect(await fs.readFile(notePath, 'utf8')).toBe('# Keep my notes')
      expect(await fs.readFile(otherPluginFile, 'utf8')).toBe('console.log("other")')
      expect(JSON.parse(await fs.readFile(path.join(vaultDir, '.obsidian', 'community-plugins.json'), 'utf8'))).toEqual([PLUGIN_ID])
    })
  })
})
