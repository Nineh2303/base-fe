import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { defineHost, defineRemote } from '../src'

const env = { command: 'serve', mode: 'development' } as const

function install(root: string, pkg: string, json: Record<string, unknown>) {
  const dir = join(root, 'node_modules', ...pkg.split('/'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify(json))
}

let cwd: string
let root: string
beforeEach(() => {
  process.env.MFE_VITE_NO_TEST_ENV_CHECK = 'true'
  cwd = process.cwd()
  root = mkdtempSync(join(tmpdir(), 'mfv-gaps-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'p', dependencies: { vue: '^3.5.0' } }))
  install(root, '@nineh-fe-base/mf-core', { version: '2.3.4' })
  process.chdir(root)
})
afterEach(() => {
  process.chdir(cwd)
  delete process.env.MFE_VITE_NO_TEST_ENV_CHECK
  rmSync(root, { recursive: true, force: true })
})

const names = (cfg: any): string[] => (cfg.plugins as any[]).flat(Infinity).filter(Boolean).map((p) => p.name)
const remote = (o: Partial<Parameters<typeof defineRemote>[0]> = {}) =>
  (defineRemote({ name: 'orders', exposes: {}, ...o }) as any)(env) as Promise<any>
const host = (o: Partial<Parameters<typeof defineHost>[0]> = {}) =>
  (defineHost({ name: 'shell', ...o }) as any)(env) as Promise<any>

describe('port and server config', () => {
  test('without a port there is no server/preview block (Vite defaults apply, no strictPort)', async () => {
    for (const cfg of [await remote(), await host()]) {
      expect(cfg.server).toBeUndefined()
      expect(cfg.preview).toBeUndefined()
    }
  })

  test('port gives strictPort and an origin on dev and preview (host and remote)', async () => {
    for (const cfg of [await remote({ port: 5010 }), await host({ port: 5000 })]) {
      expect(cfg.server.strictPort).toBe(true)
      expect(cfg.server.origin).toBe(`http://localhost:${cfg.server.port}`)
      expect(cfg.preview).toEqual({ port: cfg.server.port, strictPort: true })
    }
  })

  test('user vite.server options merge with ours instead of replacing the block', async () => {
    const cfg = await remote({ port: 5010, vite: { server: { host: true, cors: true } } })
    expect(cfg.server).toMatchObject({ port: 5010, strictPort: true, host: true, cors: true })
  })

  test('user vite.server.port wins over port; origin follows it (origin must not point at the old port)', async () => {
    const cfg = await remote({ port: 5010, vite: { server: { port: 6000 } } })
    expect(cfg.server.port).toBe(6000)
    // federation assets are served from `origin`: a stale origin makes the remote entry 404
    expect(cfg.server.origin).toBe('http://localhost:6000')
  })

  test('user server.origin is kept when given explicitly', async () => {
    const cfg = await remote({ port: 5010, vite: { server: { origin: 'https://cdn.example.com' } } })
    expect(cfg.server.origin).toBe('https://cdn.example.com')
  })
})

describe('user vite override merging', () => {
  test('user plugins are appended after the framework plugins, not dropped', async () => {
    const mine = { name: 'my-plugin' }
    const cfg = await remote({ vite: { plugins: [mine] } })
    const n = names(cfg)
    expect(n).toContain('my-plugin')
    expect(n.indexOf('my-plugin')).toBeGreaterThan(n.indexOf('nineh-mf:scope-remote-css'))
    expect(n).toContain('vite:vue')
  })

  test('user build options override scalars but keep the rest (target stays esnext unless overridden)', async () => {
    const cfg = await host({ vite: { build: { outDir: 'out', minify: false } } })
    expect(cfg.build).toMatchObject({ target: 'esnext', outDir: 'out', minify: false })
    const cfg2 = await host({ vite: { build: { target: 'es2020' } } })
    expect(cfg2.build.target).toBe('es2020')
  })

  test('undefined vite option is fine', async () => {
    await expect(remote({ vite: undefined })).resolves.toBeTruthy()
  })
})

describe('name validation', () => {
  test.each(['my-orders', '1abc', '', 'a b', 'a"b', 'a]b'])('invalid remote name %j rejects before writing anything', async (name) => {
    await expect(remote({ name })).rejects.toThrow(/Invalid federation name/)
    expect(existsSync(join(root, 'node_modules', '.nineh-mf'))).toBe(false)
  })

  test.each(['a', 'x1', 'myOrders', '_x', '$s', 'ORDERS'])('valid identifier %j accepted by host and remote', async (name) => {
    await expect(remote({ name })).resolves.toBeTruthy()
    await expect(host({ name })).resolves.toBeTruthy()
  })

  test('invalid host name rejects', async () => {
    await expect(host({ name: 'my-shell' })).rejects.toThrow(/Invalid federation name/)
  })
})

describe('mf-meta generation', () => {
  test('meta module carries the installed mf-core version and the remote name; rewritten on every call', async () => {
    await remote({ name: 'myOrders' })
    const file = join(root, 'node_modules', '.nineh-mf', 'mf-meta.js')
    expect(readFileSync(file, 'utf8')).toBe('export default {"name":"myOrders","coreVersion":"2.3.4"}')
    install(root, '@nineh-fe-base/mf-core', { version: '2.4.0' })
    await remote({ name: 'other' })
    expect(readFileSync(file, 'utf8')).toBe('export default {"name":"other","coreVersion":"2.4.0"}')
  })

  test('package.json missing in cwd rejects with a readable error', async () => {
    rmSync(join(root, 'package.json'))
    await expect(remote()).rejects.toThrow(/package\.json/)
  })

  test('invalid package.json JSON rejects', async () => {
    writeFileSync(join(root, 'package.json'), '{ nope')
    await expect(host()).rejects.toThrow()
  })
})

describe('ui detection', () => {
  const withUi = (deps: Record<string, string>, field: 'dependencies' | 'devDependencies' | 'peerDependencies') => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'p', [field]: { vue: '^3.5.0', ...deps } }))
    install(root, '@nineh-fe-base/ui', { version: '1.2.0', dependencies: { 'reka-ui': '^2.11.0' } })
  }

  test('ui in devDependencies is detected (host and remote)', async () => {
    withUi({ '@nineh-fe-base/ui': '^1.0.0' }, 'devDependencies')
    await expect(remote()).resolves.toBeTruthy()
    await expect(host()).resolves.toBeTruthy()
  })

  test('ui only as a peer dependency is not shared and its install is not required', async () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'p', peerDependencies: { '@nineh-fe-base/ui': '*' } }))
    await expect(remote()).resolves.toBeTruthy()
  })

  test('ui listed but not installed names the package in the error', async () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'p', dependencies: { '@nineh-fe-base/ui': '^1.0.0' } }))
    await expect(host()).rejects.toThrow(/@nineh-fe-base\/ui/)
  })

  test('workspace-hoisted ui (installed in a parent node_modules) is found', async () => {
    const child = join(root, 'packages', 'app')
    mkdirSync(child, { recursive: true })
    writeFileSync(join(child, 'package.json'), JSON.stringify({ name: 'app', dependencies: { '@nineh-fe-base/ui': '*' } }))
    install(root, '@nineh-fe-base/ui', { version: '3.1.0', dependencies: { 'reka-ui': '^2.9.0' } })
    process.chdir(child)
    await expect(remote()).resolves.toBeTruthy()
  })
})

describe('tailwind: false', () => {
  test('no tailwind and no css scoping plugin for a remote, federation + vue still present', async () => {
    const n = names(await remote({ tailwind: false }))
    expect(n.some((x) => x.startsWith('@tailwindcss/vite'))).toBe(false)
    expect(n).not.toContain('nineh-mf:scope-remote-css')
    expect(n).toContain('vite:vue')
    expect(n).toContain('module-federation-manifest')
  })

  test('tailwind: true / undefined are the same', async () => {
    expect(names(await remote({ tailwind: true }))).toEqual(names(await remote()))
  })
})
