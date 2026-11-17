import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { defineHost, defineRemote } from '../src'

const env = { command: 'serve', mode: 'development' } as const
const fixturesRoot = join(__dirname, 'fixtures')

function makeProject(
  base: string,
  withCore: boolean,
  pkgExtra: Record<string, unknown> = {},
  withUi = false,
): string {
  const root = mkdtempSync(join(base, 'proj-'))
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'p', dependencies: { vue: '^3.5.0', pinia: '^3.0.0' }, ...pkgExtra }),
  )
  if (withUi) {
    const dir = join(root, 'node_modules', '@nineh2303', 'ui')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ version: '0.1.0', dependencies: { 'reka-ui': '^2.11.0' } }),
    )
  }
  if (withCore) {
    const dir = join(root, 'node_modules', '@nineh2303', 'mf-core')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '0.1.0' }))
  }
  return root
}

function pluginNames(cfg: any): string[] {
  return (cfg.plugins as any[]).flat(Infinity).filter(Boolean).map((p) => p.name as string)
}

describe('defineHost/defineRemote', () => {
  const cwd = process.cwd()
  // @module-federation/vite returns no plugins under a test env unless this is set
  beforeEach(() => { process.env.MFE_VITE_NO_TEST_ENV_CHECK = 'true' })
  afterEach(() => { delete process.env.MFE_VITE_NO_TEST_ENV_CHECK })
  const created: string[] = []
  beforeEach(() => mkdirSync(fixturesRoot, { recursive: true }))
  afterEach(() => {
    process.chdir(cwd)
    for (const d of created.splice(0)) rmSync(d, { recursive: true, force: true })
    rmSync(fixturesRoot, { recursive: true, force: true })
  })

  test('defineRemote: federation plugin, port/origin, meta written, posix-safe expose', async () => {
    const root = makeProject(fixturesRoot, true)
    created.push(root)
    process.chdir(root)
    const cfg: any = await (defineRemote({ name: 'products', port: 5174, exposes: { './routes': './src/routes.ts' } }) as any)(env)
    expect(pluginNames(cfg)).toContain('module-federation-manifest')
    expect(pluginNames(cfg)).toContain('vite:vue')
    expect(cfg.server).toMatchObject({ port: 5174, strictPort: true, origin: 'http://localhost:5174' })
    expect(cfg.preview).toMatchObject({ port: 5174, strictPort: true })
    expect(cfg.build.target).toBe('esnext')
    const meta = join(root, 'node_modules', '.nineh-mf', 'mf-meta.js')
    expect(readFileSync(meta, 'utf8')).toBe('export default {"name":"products","coreVersion":"0.1.0"}')
  })

  test('defineHost: federation plugin, port, no meta written, vite option merged', async () => {
    const root = makeProject(fixturesRoot, true)
    created.push(root)
    process.chdir(root)
    const cfg: any = await (defineHost({ name: 'shell', port: 5173, vite: { build: { sourcemap: true } } }) as any)(env)
    expect(pluginNames(cfg)).toContain('module-federation-manifest')
    expect(cfg.server.origin).toBe('http://localhost:5173')
    expect(cfg.build).toMatchObject({ target: 'esnext', sourcemap: true })
    expect(existsSync(join(root, 'node_modules', '.nineh-mf'))).toBe(false)
  })

  test('missing mf-core gives a clear error', async () => {
    const root = makeProject(mkdtempSync(join(tmpdir(), 'mfv-')), false)
    created.push(join(root, '..'))
    process.chdir(root)
    await expect((defineRemote({ name: 'products', exposes: {} }) as any)(env)).rejects.toThrow(/mf-core/)
    await expect((defineHost({ name: 'shell' }) as any)(env)).rejects.toThrow(/mf-core/)
  })

  test('tailwind plugin present by default, absent with tailwind: false', async () => {
    const root = makeProject(fixturesRoot, true)
    created.push(root)
    process.chdir(root)
    const on: any = await (defineHost({ name: 'shell' }) as any)(env)
    expect(pluginNames(on).some((n) => n.startsWith('@tailwindcss/vite'))).toBe(true)
    const off: any = await (defineHost({ name: 'shell', tailwind: false }) as any)(env)
    expect(pluginNames(off).some((n) => n.startsWith('@tailwindcss/vite'))).toBe(false)
  })

  test('css scoping plugin: remotes only, after tailwind, off with tailwind: false', async () => {
    const root = makeProject(fixturesRoot, true)
    created.push(root)
    process.chdir(root)
    const remote: any = await (defineRemote({ name: 'products', exposes: {} }) as any)(env)
    const names = pluginNames(remote)
    const scopeAt = names.indexOf('nineh-mf:scope-remote-css')
    expect(scopeAt).toBeGreaterThan(names.findIndex((n) => n.startsWith('@tailwindcss/vite')))
    const host: any = await (defineHost({ name: 'shell' }) as any)(env)
    expect(pluginNames(host)).not.toContain('nineh-mf:scope-remote-css')
    const off: any = await (defineRemote({ name: 'products', exposes: {}, tailwind: false }) as any)(env)
    expect(pluginNames(off)).not.toContain('nineh-mf:scope-remote-css')
  })

  test('css scoping plugin skips the installed ui host.css (standalone entry)', async () => {
    const root = makeProject(fixturesRoot, true, {}, true)
    created.push(root)
    process.chdir(root)
    const hostCss = join(root, 'node_modules', '@nineh2303', 'ui', 'styles', 'host.css')
    mkdirSync(join(hostCss, '..'), { recursive: true })
    writeFileSync(hostCss, '')
    const cfg: any = await (defineRemote({ name: 'products', exposes: {} }) as any)(env)
    const plugin = (cfg.plugins as any[]).flat(Infinity).find((p) => p?.name === 'nineh-mf:scope-remote-css')
    expect(plugin.transform('.a{}', hostCss.replace(/\\/g, '/'))).toBeFalsy()
    expect(plugin.transform('.a{}', join(root, 'src', 'style.css'))?.code).toContain('@scope')
  })
})
