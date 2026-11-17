import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const captured: any[] = []
vi.mock('@module-federation/vite', () => ({
  federation: (o: any) => {
    captured.push(o)
    return { name: 'mock-federation' }
  },
}))

import { defineHost, defineRemote } from '../src'

const env = { command: 'build', mode: 'production' } as const

function names(cfg: any): string[] {
  return (cfg.plugins as any[]).flat(Infinity).filter(Boolean).map((p) => p.name as string)
}

function writeInstalled(root: string, pkg: string, json: object) {
  const dir = join(root, 'node_modules', ...pkg.split('/'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify(json))
}

function project(
  pkg: Record<string, unknown>,
  ui: false | { version?: string; dependencies?: Record<string, string> } = false,
): string {
  const root = mkdtempSync(join(tmpdir(), 'mfv-shared-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'p', ...pkg }))
  writeInstalled(root, '@nineh2303/mf-core', { version: '0.3.0' })
  if (ui) writeInstalled(root, '@nineh2303/ui', { version: '0.1.0', dependencies: { 'reka-ui': '^2.11.0' }, ...ui })
  return root
}

describe('define: resolved shared config and tailwind', () => {
  const cwd = process.cwd()
  const dirs: string[] = []
  beforeEach(() => {
    captured.length = 0
  })
  afterEach(() => {
    process.chdir(cwd)
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })
  async function host(pkg: any, ui: any, opts: any = {}) {
    const root = project(pkg, ui)
    dirs.push(root)
    process.chdir(root)
    const cfg: any = await (defineHost({ name: 'shell', ...opts }) as any)(env)
    return { cfg, shared: captured.at(-1).shared }
  }

  test.each(['dependencies', 'devDependencies'])('ui in %s -> ui and reka-ui singletons', async (field) => {
    const { shared } = await host({ [field]: { '@nineh2303/ui': '^0.1.0' } }, {})
    expect(shared['@nineh2303/ui']).toEqual({ singleton: true, requiredVersion: '^0.1.0' })
    expect(shared['reka-ui']).toEqual({ singleton: true, requiredVersion: '^2.11.0' })
  })

  test('ui only in peerDependencies -> not shared', async () => {
    const { shared } = await host({ peerDependencies: { '@nineh2303/ui': '^0.1.0' } }, {})
    expect(shared['@nineh2303/ui']).toBeUndefined()
    expect(shared['reka-ui']).toBeUndefined()
  })

  test('ui listed but not installed -> error naming the package', async () => {
    const root = project({ dependencies: { '@nineh2303/ui': '^0.1.0' } }, false)
    dirs.push(root)
    process.chdir(root)
    await expect((defineHost({ name: 'shell' }) as any)(env)).rejects.toThrow(/@nineh2303\/ui/)
  })

  test.each(['*', 'file:../ui', 'workspace:*'])('local spec %s -> ^0.1.0', async (spec) => {
    const { shared } = await host({ dependencies: { '@nineh2303/ui': spec } }, { version: '0.1.0' })
    expect(shared['@nineh2303/ui'].requiredVersion).toBe('^0.1.0')
  })

  test('reka-ui requiredVersion follows the installed ui package.json', async () => {
    const { shared } = await host(
      { dependencies: { '@nineh2303/ui': '^0.1.0' } },
      { dependencies: { 'reka-ui': '~2.9.3' } },
    )
    expect(shared['reka-ui'].requiredVersion).toBe('~2.9.3')
  })

  test('user override cannot drop singleton for ui, reka-ui or core five', async () => {
    const off = { singleton: false }
    const { shared } = await host(
      { dependencies: { '@nineh2303/ui': '^0.1.0' } },
      {},
      {
        shared: {
          '@nineh2303/ui': off,
          'reka-ui': off,
          vue: off,
          pinia: off,
          'vue-router': off,
          'vue-i18n': off,
          '@nineh2303/mf-core': off,
        },
      },
    )
    for (const n of ['@nineh2303/ui', 'reka-ui', 'vue', 'pinia', 'vue-router', 'vue-i18n', '@nineh2303/mf-core']) {
      expect(shared[n].singleton, n).toBe(true)
    }
  })

  test('tailwind plugin default on, off with tailwind:false; user plugins merge (host + remote)', async () => {
    const userPlugin = { name: 'user-plugin' }
    const on = await host({}, false, { vite: { plugins: [userPlugin] } })
    expect(names(on.cfg).some((n) => n.startsWith('@tailwindcss/vite'))).toBe(true)
    expect(names(on.cfg)).toContain('user-plugin')
    const off = await host({}, false, { tailwind: false, vite: { plugins: [userPlugin] } })
    expect(names(off.cfg).some((n) => n.startsWith('@tailwindcss/vite'))).toBe(false)
    expect(names(off.cfg)).toContain('user-plugin')

    for (const tailwind of [undefined, false]) {
      const root = project({}, false)
      dirs.push(root)
      process.chdir(root)
      const cfg: any = await (defineRemote({ name: 'r', exposes: {}, tailwind, vite: { plugins: [userPlugin] } }) as any)(env)
      expect(names(cfg).some((n) => n.startsWith('@tailwindcss/vite'))).toBe(tailwind !== false)
      expect(names(cfg)).toContain('user-plugin')
    }
  })
})
