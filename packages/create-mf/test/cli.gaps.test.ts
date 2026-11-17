import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const CLI = join(here, '..', 'dist', 'index.js')
// The CLI is exercised through the built binary; skip (visibly) when it has not been built.
const cli = existsSync(CLI) ? describe : describe.skip

let cwd: string
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'cmf-cli-'))
})
afterEach(() => rmSync(cwd, { recursive: true, force: true }))

function run(...args: string[]) {
  // stdin is not a TTY (piped), so the interactive prompts never start
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input: '' })
  return { code: r.status, out: r.stdout, err: r.stderr }
}

cli('create-mf CLI (built dist/index.js)', () => {
  it('-h / --help prints usage on stdout and exits 0', () => {
    for (const flag of ['-h', '--help']) {
      const r = run(flag)
      expect(r.code).toBe(0)
      expect(r.out).toContain('Usage: create-mf')
      expect(r.out).toContain('ui add')
    }
  })

  it('no arguments, non-TTY: exits 1 with usage on stderr', () => {
    const r = run()
    expect(r.code).toBe(1)
    expect(r.err).toContain('Missing arguments')
    expect(r.err).toContain('Usage: create-mf')
  })

  it('name without --kind, or --kind without name, exits 1 and creates nothing', () => {
    expect(run('orders').code).toBe(1)
    expect(run('--kind', 'remote').code).toBe(1)
    expect(existsSync(join(cwd, 'orders'))).toBe(false)
  })

  it('invalid --kind exits 1 naming the value', () => {
    const r = run('orders', '--kind', 'widget')
    expect(r.code).toBe(1)
    expect(r.err).toContain('Invalid --kind "widget"')
  })

  it.each(['0', '65536', '-1', '70000', 'abc', '', '1.5'])('invalid --port %j exits 1 and creates nothing', (port) => {
    const r = run('orders', '--kind', 'remote', `--port=${port}`)
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/Invalid port/)
    expect(existsSync(join(cwd, 'orders'))).toBe(false)
  })

  it('boundary ports 1 and 65535 are accepted', () => {
    expect(run('a1', '--kind', 'remote', '--port', '1').code).toBe(0)
    expect(run('a2', '--kind', 'remote', '--port', '65535').code).toBe(0)
    expect(readFileSync(join(cwd, 'a2', 'vite.config.ts'), 'utf8')).toContain('port: 65535')
  })

  it('unknown option exits 1 with a message and usage, not a stack trace', () => {
    const r = run('orders', '--kind', 'remote', '--bogus')
    expect(r.code).toBe(1)
    expect(r.err).toContain('--bogus')
    expect(r.err).toContain('Usage: create-mf')
    expect(r.err).not.toMatch(/\n\s+at /)
  })

  it('option missing its value exits 1 without a stack trace', () => {
    const r = run('orders', '--kind')
    expect(r.code).toBe(1)
    expect(r.err).not.toMatch(/\n\s+at /)
  })

  it('creates a remote with the default port and prints next steps', () => {
    const r = run('orders', '--kind', 'remote')
    expect(r.code).toBe(0)
    expect(r.out).toContain('Created remote "orders"')
    expect(r.out).toContain('npm install')
    expect(readFileSync(join(cwd, 'orders', 'vite.config.ts'), 'utf8')).toContain('port: 5010')
  })

  it('creates a host with the default port 5000', () => {
    expect(run('shell', '--kind', 'host').code).toBe(0)
    expect(readFileSync(join(cwd, 'shell', 'vite.config.ts'), 'utf8')).toContain('5000')
  })

  it('"ui" alone scaffolds a project named ui (only "ui add" routes to eject)', () => {
    const r = run('ui', '--kind', 'remote')
    expect(r.code).toBe(0)
    expect(JSON.parse(readFileSync(join(cwd, 'ui', 'package.json'), 'utf8')).name).toBe('ui')
  })

  it('"ui add" routes to eject: fails clearly when ui is not installed', () => {
    const r = run('ui', 'add', 'button')
    expect(r.code).toBe(1)
    expect(r.err).toContain('Cannot find @nineh2303/ui')
    expect(existsSync(join(cwd, 'src'))).toBe(false)
  })

  it('"ui add" ejects an installed component, lists written files, and errors on unknown names', () => {
    const uiDir = join(cwd, 'node_modules', '@nineh2303', 'ui')
    const comp = join(uiDir, 'src', 'components', 'badge')
    mkdirSync(comp, { recursive: true })
    writeFileSync(join(uiDir, 'package.json'), '{"version":"1.0.0"}')
    writeFileSync(join(comp, 'index.ts'), 'export const badge = 1\n')

    const ok = run('ui', 'add', 'badge')
    expect(ok.code).toBe(0)
    expect(ok.out).toContain('Ejected 1 file(s)')
    expect(existsSync(join(cwd, 'src', 'components', 'ui', 'badge', 'index.ts'))).toBe(true)

    // second run refuses to overwrite, --force allows it
    const again = run('ui', 'add', 'badge')
    expect(again.code).toBe(1)
    expect(again.err).toContain('--force')
    expect(run('ui', 'add', 'badge', '--force').code).toBe(0)

    const unknown = run('ui', 'add', 'nope')
    expect(unknown.code).toBe(1)
    expect(unknown.err).toContain('Unknown component: nope')
    expect(unknown.err).toContain('badge')

    const custom = run('ui', 'add', 'badge', '--dir', 'lib/x')
    expect(custom.code).toBe(0)
    expect(existsSync(join(cwd, 'lib', 'x', 'badge', 'index.ts'))).toBe(true)

    const none = run('ui', 'add')
    expect(none.code).toBe(1)
    expect(none.err).toContain('No component names given')
  })

  it('name validation: hyphen, digit start, uppercase host are rejected; remote may be camelCase', () => {
    expect(run('my-orders', '--kind', 'remote').err).toContain('Invalid remote name')
    expect(run('1abc', '--kind', 'remote').code).toBe(1)
    expect(run('Shell', '--kind', 'host').err).toContain('Invalid host name')
    expect(run('myOrders', '--kind', 'remote').code).toBe(0)
    expect(existsSync(join(cwd, 'my-orders'))).toBe(false)
  })

  it('existing non-empty target dir exits 1 and leaves it untouched; empty dir is fine', () => {
    mkdirSync(join(cwd, 'full'))
    writeFileSync(join(cwd, 'full', 'keep.txt'), 'x')
    const r = run('full', '--kind', 'remote')
    expect(r.code).toBe(1)
    expect(r.err).toContain('is not empty')
    expect(readFileSync(join(cwd, 'full', 'keep.txt'), 'utf8')).toBe('x')
    expect(existsSync(join(cwd, 'full', 'package.json'))).toBe(false)

    mkdirSync(join(cwd, 'empty'))
    expect(run('empty', '--kind', 'remote').code).toBe(0)
  })

  it('target path that is an existing file exits 1 with a message (no stack trace)', () => {
    writeFileSync(join(cwd, 'afile'), 'x')
    const r = run('afile', '--kind', 'remote')
    expect(r.code).toBe(1)
    expect(r.err).not.toMatch(/\n\s+at /)
  })

  it('nested path: directory is nested, name is the basename', () => {
    const r = run('apps/orders', '--kind', 'remote')
    expect(r.code).toBe(0)
    expect(JSON.parse(readFileSync(join(cwd, 'apps', 'orders', 'package.json'), 'utf8')).name).toBe('orders')
  })
})
