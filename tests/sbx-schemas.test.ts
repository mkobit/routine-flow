import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  kitBuildSpecV2Schema,
  kitMixinSpecV2Schema,
  kitSandboxSpecV2Schema,
  kitSpecSchema,
  kitSpecV1Schema,
  sbxEnvV1Schema,
} from '../scripts/sbx-schemas'

describe('sbx-schemas', () => {
  const rootDir = path.resolve(import.meta.dirname, '..')

  describe('kitMixinSpecV2Schema', () => {
    test('validates normative mixin kit spec', () => {
      const spec = {
        schemaVersion: '2',
        kind: 'mixin',
        name: 'test-toolchain',
        version: '0.1.0',
        description: 'Test mixin kit',
        permissions: {
          network: {
            allow: ['github.com', 'bun.sh'],
          },
        },
        environment: {
          variables: {
            PATH: '/usr/local/bin:/usr/bin:/bin',
            MISE_YES: '1',
          },
        },
        setup: {
          install: [
            { command: 'curl https://mise.run | sh', description: 'Install mise' },
          ],
        },
      }

      const result = kitMixinSpecV2Schema.safeParse(spec)
      expect(result.success).toBe(true)
    })

    test('rejects invalid kit name with uppercase or spaces', () => {
      const spec = {
        schemaVersion: '2',
        kind: 'mixin',
        name: 'Invalid_Name!',
      }

      const result = kitMixinSpecV2Schema.safeParse(spec)
      expect(result.success).toBe(false)
    })
  })

  describe('kitSandboxSpecV2Schema', () => {
    test('validates normative sandbox kit spec', () => {
      const spec = {
        schemaVersion: '2',
        kind: 'sandbox',
        name: 'test-sandbox',
        sandbox: {
          image: 'docker/sandbox-base:ubuntu-24.04',
          command: ['/bin/bash'],
          resources: {
            cpu: 4,
            memory: '8GB',
          },
        },
      }

      const result = kitSandboxSpecV2Schema.safeParse(spec)
      expect(result.success).toBe(true)
    })
  })

  describe('kitBuildSpecV2Schema', () => {
    test('validates build-step kit spec format', () => {
      const spec = {
        schemaVersion: 2,
        name: 'build-toolchain',
        base: 'docker/sandbox-base:ubuntu-24.04',
        build: {
          steps: [
            { name: 'setup', command: 'echo hello' },
          ],
        },
      }

      const result = kitBuildSpecV2Schema.safeParse(spec)
      expect(result.success).toBe(true)
    })
  })

  describe('kitSpecV1Schema', () => {
    test('validates legacy v1 kit spec', () => {
      const spec = {
        schemaVersion: '1',
        name: 'legacy-toolchain',
        commands: {
          install: ['curl https://mise.run | sh'],
        },
      }

      const result = kitSpecV1Schema.safeParse(spec)
      expect(result.success).toBe(true)
    })
  })

  describe('sbxEnvV1Schema', () => {
    test('validates environment descriptors with ports', () => {
      const env = {
        schemaVersion: '1',
        name: 'routine-flow-test',
        agent: 'codex',
        workspace: {
          path: '..',
          clone: true,
        },
        kits: ['./kit'],
        ports: [
          { sandbox: 3000, host: 3000 },
          { sandbox: 6080, host: 6080 },
        ],
      }

      const result = sbxEnvV1Schema.safeParse(env)
      expect(result.success).toBe(true)
    })

    test('rejects invalid sandbox port numbers', () => {
      const env = {
        schemaVersion: '1',
        agent: 'codex',
        workspace: {
          path: '..',
          clone: true,
        },
        ports: [
          { sandbox: 999_999 },
        ],
      }

      const result = sbxEnvV1Schema.safeParse(env)
      expect(result.success).toBe(false)
    })
  })

  describe('repository sandbox artifacts', () => {
    test('.sbx/kit/spec.yaml matches kitSpecSchema', () => {
      const kitPath = path.join(rootDir, '.sbx/kit/spec.yaml')
      const content = fs.readFileSync(kitPath, 'utf8')
      const parsed = Bun.YAML.parse(content)
      const result = kitSpecSchema.safeParse(parsed)
      expect(result.success).toBe(true)
    })

    test('.sbx/.sbxenv.yaml matches sbxEnvV1Schema and has required ports', () => {
      const envPath = path.join(rootDir, '.sbx/.sbxenv.yaml')
      const content = fs.readFileSync(envPath, 'utf8')
      const parsed = Bun.YAML.parse(content)
      const result = sbxEnvV1Schema.safeParse(parsed)
      expect(result.success).toBe(true)
      if (!result.success) {
        return
      }

      const ports = result.data.ports?.map(p => p.sandbox) ?? []
      expect(ports).toContain(3000)
      expect(ports).toContain(5900)
      expect(ports).toContain(6080)
      expect(ports).toContain(9222)
    })

    test('.sbx/.sbxenv.agy.yaml matches sbxEnvV1Schema and has required ports', () => {
      const envPath = path.join(rootDir, '.sbx/.sbxenv.agy.yaml')
      const content = fs.readFileSync(envPath, 'utf8')
      const parsed = Bun.YAML.parse(content)
      const result = sbxEnvV1Schema.safeParse(parsed)
      expect(result.success).toBe(true)
      if (!result.success) {
        return
      }

      const ports = result.data.ports?.map(p => p.sandbox) ?? []
      expect(ports).toContain(3000)
      expect(ports).toContain(5900)
      expect(ports).toContain(6080)
      expect(ports).toContain(9222)
    })
  })
})
