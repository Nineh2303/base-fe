import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generate } from '../src/generate'

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
    expect(pkg.dependencies['@nineh-fe-base/mf-core']).toBe('^1.2.3')
    expect(pkg.devDependencies['@nineh-fe-base/mf-vite']).toBe('^1.2.3')
    expect(pkg.scripts.typecheck).toBeTruthy()
    expect(read(targetDir, '.npmrc')).toContain('@nineh-fe-base:registry=https://npm.pkg.github.com')
    expect(read(targetDir, '.gitignore')).toContain('node_modules')
    expect(existsSync(join(targetDir, '_gitignore'))).toBe(false)
    expect(read(targetDir, 'src/main.ts')).toContain("import('./bootstrap')")
    expect(read(targetDir, 'src/stores/sample.ts')).toContain("defineStore('orders/sample'")
    expect(read(targetDir, 'src/bootstrap.ts')).toContain("name: 'orders'")
    expect(read(targetDir, 'src/bootstrap.ts')).toContain("routePrefix: '/orders'")
    expect(JSON.stringify(pkg)).not.toContain('msw')
    // no unreplaced placeholders anywhere
    for (const f of ['package.json', 'index.html', 'vite.config.ts', 'src/bootstrap.ts', 'README.md']) {
      expect(read(targetDir, f)).not.toMatch(/\{\{\w+\}\}/)
    }
  })

  it('generates a host', async () => {
    const targetDir = join(base, 'shell')
    await generate({ kind: 'host', name: 'shell', targetDir, port: 5000, frameworkVersion: '1.2.3' })

    expect(JSON.parse(read(targetDir, 'public/remotes.json'))).toEqual({ remotes: [] })
    expect(read(targetDir, 'vite.config.ts')).toContain("defineHost({ name: 'shell'")
    expect(read(targetDir, 'src/bootstrap.ts')).toContain("jwtAdapter({ baseURL: '/api' })")
    expect(read(targetDir, '.npmrc')).toContain('@nineh-fe-base:registry')
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
