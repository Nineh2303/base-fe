import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copyDir, generate, toPackageName } from '../src/generate'

let base: string
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'create-mf-'))
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

const read = (dir: string, file: string) => readFileSync(join(dir, file), 'utf8')

describe('generate', () => {
  it('generates a remote', async () => {
    const targetDir = join(base, 'orders')
    await generate({ kind: 'remote', name: 'orders', targetDir, port: 5010, frameworkVersion: '1.2.3' })

    expect(read(targetDir, 'vite.config.ts')).toContain("defineRemote({\n  name: 'orders'")
    expect(read(targetDir, 'vite.config.ts')).toContain('port: 5010')
    const pkg = JSON.parse(read(targetDir, 'package.json'))
    expect(pkg.name).toBe('orders')
    expect(pkg.dependencies['@nineh2303/mf-core']).toBe('^1.2.3')
    expect(pkg.devDependencies['@nineh2303/mf-vite']).toBe('^1.2.3')
    expect(pkg.scripts.typecheck).toBeTruthy()
    expect(read(targetDir, '.npmrc')).toContain('@nineh2303:registry=https://npm.pkg.github.com')
    expect(read(targetDir, '.gitignore')).toContain('node_modules')
    expect(existsSync(join(targetDir, '_gitignore'))).toBe(false)
    expect(read(targetDir, 'src/main.ts')).toContain("import('./bootstrap')")
    expect(read(targetDir, 'src/stores/sample.ts')).toContain("defineStore('orders/sample'")
    expect(read(targetDir, 'src/bootstrap.ts')).toContain("name: 'orders'")
    expect(read(targetDir, 'src/bootstrap.ts')).toContain("routePrefix: '/orders'")
    expect(JSON.stringify(pkg)).not.toContain('msw')
    // no unreplaced placeholders anywhere
    for (const f of ['package.json', 'index.html', 'vite.config.ts', 'src/bootstrap.ts', 'README.md']) {
      expect(read(targetDir, f)).not.toMatch(/%%\w+%%/)
    }
  })

  it('generates a host', async () => {
    const targetDir = join(base, 'shell')
    await generate({ kind: 'host', name: 'shell', targetDir, port: 5000, frameworkVersion: '1.2.3' })

    expect(JSON.parse(read(targetDir, 'public/remotes.json'))).toEqual({ remotes: [] })
    expect(read(targetDir, 'vite.config.ts')).toContain("defineHost({ name: 'shell'")
    expect(read(targetDir, 'src/bootstrap.ts')).toContain("jwtAdapter({ baseURL: '/api' })")
    expect(read(targetDir, '.npmrc')).toContain('@nineh2303:registry')
    expect(read(targetDir, 'src/main.ts')).toContain("import('./bootstrap')")
  })

  it('allows an existing empty target dir', async () => {
    const targetDir = join(base, 'empty')
    mkdirSync(targetDir)
    await generate({ kind: 'remote', name: 'orders', targetDir, frameworkVersion: '1.0.0' })
    expect(existsSync(join(targetDir, 'package.json'))).toBe(true)
  })

  it('throws when the target dir is not empty', async () => {
    const targetDir = join(base, 'full')
    mkdirSync(targetDir)
    writeFileSync(join(targetDir, 'x.txt'), 'x')
    await expect(
      generate({ kind: 'remote', name: 'orders', targetDir, frameworkVersion: '1.0.0' }),
    ).rejects.toThrow(/not empty/)
  })

  it('rejects an invalid remote name', async () => {
    await expect(
      generate({ kind: 'remote', name: 'my-orders', targetDir: join(base, 'a'), frameworkVersion: '1.0.0' }),
    ).rejects.toThrow(/Invalid remote name/)
  })

  it('rejects an invalid host name', async () => {
    await expect(
      generate({ kind: 'host', name: 'my-shell', targetDir: join(base, 'b'), frameworkVersion: '1.0.0' }),
    ).rejects.toThrow(/Invalid host name/)
  })
})

describe('host names', () => {
  it('rejects uppercase host names (not a valid npm name)', async () => {
    await expect(
      generate({ kind: 'host', name: 'MyShell', targetDir: join(tmpdir(), 'cmf-never'), frameworkVersion: '1.0.0' }),
    ).rejects.toThrow(/Invalid host name/)
  })
})

describe('generated host usability', () => {
  it('host provides the /auth/login route the auth guard redirects to; remote sample route is public', async () => {
    const host = join(base, 'shell')
    await generate({ kind: 'host', name: 'shell', targetDir: host, frameworkVersion: '1.2.3' })
    expect(read(host, 'src/bootstrap.ts')).toContain("path: '/auth/login'")
    expect(existsSync(join(host, 'src/pages/Login.vue'))).toBe(true)
    const remote = join(base, 'orders')
    await generate({ kind: 'remote', name: 'orders', targetDir: remote, frameworkVersion: '1.2.3' })
    expect(read(remote, 'src/routes.ts')).toContain('requiresAuth: false')
  })

  it('remote bootstrap + README warn that standalone has no /auth/login (jwtAdapter needs a login route)', async () => {
    const remote = join(base, 'orders2')
    await generate({ kind: 'remote', name: 'orders2', targetDir: remote, frameworkVersion: '1.2.3' })
    for (const f of ['src/bootstrap.ts', 'README.md']) {
      expect(read(remote, f), f).toContain('/auth/login')
      expect(read(remote, f), f).toContain('jwtAdapter')
    }
  })
})

describe('package names and placeholders', () => {
  it('derives an npm-safe package name but keeps the federation name as given', async () => {
    const dir = join(base, 'myOrders')
    await generate({ kind: 'remote', name: 'myOrders', targetDir: dir, frameworkVersion: '1.0.0' })
    expect(JSON.parse(read(dir, 'package.json')).name).toBe('my-orders')
    expect(read(dir, 'vite.config.ts')).toContain("defineRemote({\n  name: 'myOrders'")
    expect(read(dir, 'src/stores/sample.ts')).toContain("defineStore('myOrders/sample'")
  })

  it('toPackageName handles odd identifiers', () => {
    expect(toPackageName('my$remote')).toBe('my-remote')
    expect(toPackageName('Orders')).toBe('orders')
    expect(toPackageName('orders')).toBe('orders')
    expect(toPackageName('_priv')).toBe('priv')
    expect(toPackageName('$')).toBe('app')
  })

  it('leaves Vue mustaches intact and leaves no %% placeholder behind', async () => {
    const remote = join(base, 'orders')
    const host = join(base, 'shell')
    await generate({ kind: 'remote', name: 'orders', targetDir: remote, frameworkVersion: '1.0.0' })
    await generate({ kind: 'host', name: 'shell', targetDir: host, frameworkVersion: '1.0.0' })
    expect(read(remote, 'src/pages/SamplePage.vue')).toContain('{{ user ? ')
    expect(read(remote, 'src/pages/SamplePage.vue')).toContain('{{ count }}')
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((e) => (statSync(join(d, e)).isDirectory() ? walk(join(d, e)) : [join(d, e)]))
    for (const f of [...walk(remote), ...walk(host)]) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/%%\w+%%/)
    }
  })

  it('does not touch mustaches without spaces or binary files', () => {
    const src = join(base, 'tpl')
    mkdirSync(src)
    const bin = Buffer.from([0, 1, 2, 0x25, 0x25, 0x6e, 0x61, 0x6d, 0x65, 0x25, 0x25, 0, 255])
    writeFileSync(join(src, 'a.vue'), '{{count}} %%name%%')
    writeFileSync(join(src, 'b.bin'), bin)
    const dest = join(base, 'out')
    copyDir(src, dest, { name: 'x' })
    expect(read(dest, 'a.vue')).toBe('{{count}} x')
    expect(readFileSync(join(dest, 'b.bin')).equals(bin)).toBe(true)
  })
})

describe('tailwind + ui templates', () => {
  it('host depends on ui and tailwind, imports host.css, mounts one Toaster', async () => {
    const host = join(base, 'shell')
    await generate({ kind: 'host', name: 'shell', targetDir: host, frameworkVersion: '1.2.3' })
    const pkg = JSON.parse(read(host, 'package.json'))
    expect(pkg.dependencies['@nineh2303/ui']).toBe('^1.2.3')
    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^4\./)
    expect(read(host, 'src/bootstrap.ts')).toContain("import '@nineh2303/ui/styles/host.css'")
    expect(read(host, 'src/Layout.vue')).toContain('<Toaster')
    expect(read(host, 'src/pages/Login.vue')).toContain('@nineh2303/ui')
  })

  it('remote has style.css with remote.css and scoped token example, routes imports it', async () => {
    const remote = join(base, 'orders')
    await generate({ kind: 'remote', name: 'orders', targetDir: remote, frameworkVersion: '1.2.3' })
    const pkg = JSON.parse(read(remote, 'package.json'))
    expect(pkg.dependencies['@nineh2303/ui']).toBe('^1.2.3')
    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^4\./)
    const css = read(remote, 'src/style.css')
    expect(css).toContain('@nineh2303/ui/styles/remote.css')
    expect(css).toContain('[data-mf-remote="orders"]')
    expect(read(remote, 'src/routes.ts')).toContain("import './style.css'")
    expect(read(remote, 'src/bootstrap.ts')).toContain('@nineh2303/ui/styles/host.css')
    expect(read(remote, 'src/pages/SamplePage.vue')).toContain('@nineh2303/ui')
  })
})
