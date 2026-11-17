import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copyDir, generate, render, toPackageName, validateName, validatePort } from '../src/generate'

let base: string
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'cmf-tpl-'))
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((e) => (statSync(join(d, e)).isDirectory() ? walk(join(d, e)) : [join(d, e)]))

describe('templates with odd names', () => {
  const remoteNames = ['a', 'x1', 'myOrders', '_x', '$s', 'A', 'ORDERS_2']
  const hostNames = ['a', 'x1', 'my_shell', 'shell2']

  it.each(remoteNames)('remote %j: no placeholder left, JSON valid, name wired through', async (name) => {
    const dir = join(base, 'r')
    await generate({ kind: 'remote', name, targetDir: dir, port: 5123, frameworkVersion: '9.8.7' })
    for (const f of walk(dir)) expect(readFileSync(f, 'utf8'), f).not.toMatch(/%%\w+%%/)
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    expect(pkg.name).toBe(toPackageName(name))
    expect(pkg.name).toMatch(/^[a-z0-9-~][a-z0-9-._~]*$/)
    expect(pkg.dependencies['@nineh2303/mf-core']).toBe('^9.8.7')
    expect(readFileSync(join(dir, 'vite.config.ts'), 'utf8')).toContain(`name: '${name}'`)
    expect(readFileSync(join(dir, 'vite.config.ts'), 'utf8')).toContain('port: 5123')
    expect(readFileSync(join(dir, 'src/bootstrap.ts'), 'utf8')).toContain(`name: '${name}'`)
    expect(readFileSync(join(dir, 'src/stores/sample.ts'), 'utf8')).toContain(`defineStore('${name}/sample'`)
    expect(readFileSync(join(dir, 'src/style.css'), 'utf8')).toContain(`[data-mf-remote="${name}"]`)
    expect(readFileSync(join(dir, 'README.md'), 'utf8')).toContain(`"routePrefix": "/${name}"`)
    expect(readFileSync(join(dir, 'README.md'), 'utf8')).toContain('http://localhost:5123/mf-manifest.json')
    rmSync(dir, { recursive: true, force: true })
  })

  it.each(hostNames)('host %j: no placeholder left, JSON valid, name wired through', async (name) => {
    const dir = join(base, 'h')
    await generate({ kind: 'host', name, targetDir: dir, frameworkVersion: '9.8.7' })
    for (const f of walk(dir)) expect(readFileSync(f, 'utf8'), f).not.toMatch(/%%\w+%%/)
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    expect(pkg.name).toBe(toPackageName(name))
    expect(JSON.parse(readFileSync(join(dir, 'public/remotes.json'), 'utf8'))).toEqual({ remotes: [] })
    expect(readFileSync(join(dir, 'vite.config.ts'), 'utf8')).toContain(`name: '${name}'`)
    expect(readFileSync(join(dir, 'vite.config.ts'), 'utf8')).toContain('port: 5000')
    expect(readFileSync(join(dir, 'index.html'), 'utf8')).toContain(`<title>${name}</title>`)
    rmSync(dir, { recursive: true, force: true })
  })

  it('every VERSIONS placeholder resolves to a semver range in package.json (host and remote)', async () => {
    for (const kind of ['host', 'remote'] as const) {
      const dir = join(base, kind)
      await generate({ kind, name: 'x1', targetDir: dir, frameworkVersion: '1.0.0' })
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      const all = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }
      for (const [k, v] of Object.entries(all)) expect(v, `${kind}:${k}`).toMatch(/^[\^~]?\d+\.\d+\.\d+/)
    }
  })

  it('generated dotfiles are real dotfiles; the underscore sources are not left behind (both kinds)', async () => {
    for (const kind of ['host', 'remote'] as const) {
      const dir = join(base, kind + '-dot')
      await generate({ kind, name: 'x1', targetDir: dir, frameworkVersion: '1.0.0' })
      const files = walk(dir).map((f) => f.slice(dir.length + 1).replace(/\\/g, '/'))
      expect(files).toContain('.gitignore')
      expect(files).toContain('.npmrc')
      expect(files.some((f) => f.endsWith('_gitignore') || f.endsWith('_npmrc'))).toBe(false)
    }
  })

  it('a renamed file nested in a subfolder is renamed too', () => {
    const src = join(base, 'src')
    mkdirSync(join(src, 'sub'), { recursive: true })
    writeFileSync(join(src, 'sub', '_gitignore'), 'x')
    copyDir(src, join(base, 'out'), {})
    expect(readFileSync(join(base, 'out', 'sub', '.gitignore'), 'utf8')).toBe('x')
  })
})

describe('render', () => {
  it('replacement text containing $ patterns is inserted literally', () => {
    const out = render(Buffer.from('a %%name%% b'), { name: "$&$1$'$`$$" })
    expect(out.toString()).toBe("a $&$1$'$`$$ b")
  })

  it('unknown placeholders and non-word %% sequences stay; binary (NUL) content is byte-identical', () => {
    expect(render(Buffer.from('%%nope%% 100%% %%a-b%%'), { name: 'x' }).toString()).toBe('%%nope%% 100%% %%a-b%%')
    const bin = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0xff, 0xfe, 0x25, 0x25, 0x6e, 0x61, 0x6d, 0x65, 0x25, 0x25])
    expect(render(bin, { name: 'x' }).equals(bin)).toBe(true)
  })

  it('placeholder keys that collide with Object.prototype members are not substituted', () => {
    const out = render(Buffer.from('%%constructor%% %%toString%%'), { name: 'x' })
    expect(out.toString()).toBe('%%constructor%% %%toString%%')
  })

  it('multi-byte UTF-8 text survives rendering', () => {
    expect(render(Buffer.from('Đơn hàng %%name%% ✓'), { name: 'x' }).toString()).toBe('Đơn hàng x ✓')
  })
})

describe('validation helpers', () => {
  it('validatePort', () => {
    for (const ok of [1, 80, 65535]) expect(validatePort(ok)).toBeUndefined()
    for (const bad of [0, -1, 65536, 1.5, NaN, Infinity]) expect(validatePort(bad)).toMatch(/Invalid port/)
  })

  it('validateName: JS identifier for both kinds, lowercase for host', () => {
    expect(validateName('remote', 'myOrders')).toBeUndefined()
    expect(validateName('remote', '$a')).toBeUndefined()
    expect(validateName('remote', '')).toMatch(/Invalid/)
    expect(validateName('remote', 'a b')).toMatch(/Invalid/)
    expect(validateName('remote', 'class')).toBeUndefined() // reserved word is still accepted as a container name
    expect(validateName('host', 'shell')).toBeUndefined()
    expect(validateName('host', 'Shell')).toMatch(/lowercase/)
    expect(validateName('host', 'my-shell')).toMatch(/identifier/)
  })

  it('toPackageName output always satisfies the npm name pattern', () => {
    for (const n of ['A', 'ABC', 'myOrders', 'HTMLParser', '$', '_', 'a$b$c', 'x1Y2', 'Order$$Items']) {
      expect(toPackageName(n), n).toMatch(/^[a-z0-9-~][a-z0-9-._~]*$/)
    }
    expect(toPackageName('HTMLParser')).not.toContain('--')
  })
})

describe('host names with $', () => {
  it('host names containing $ are rejected (not a valid npm package name)', async () => {
    await expect(
      generate({ kind: 'host', name: 'shell$', targetDir: join(tmpdir(), 'cmf-never2'), frameworkVersion: '1.0.0' }),
    ).rejects.toThrow(/Invalid host name/)
  })
})
