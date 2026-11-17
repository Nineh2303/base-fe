import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as ui from '../src/index'
// Ejected copies import the shared package; resolve it to src for this file only.
vi.mock('@nineh2303/ui', () => import('../src/index'))
import { ejectComponents } from '../../create-mf/src/eject'

const root = resolve(__dirname, '..')
const out = resolve(__dirname, '.eject-tmp')
const components = readdirSync(join(root, 'src/components')).filter((n) =>
  statSync(join(root, 'src/components', n)).isDirectory(),
)

async function load(name: string) {
  const href = join(out, name, 'index.ts').replaceAll(String.fromCharCode(92), '/')
  return import(/* @vite-ignore */ href)
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('ejected components (all)', () => {
  beforeAll(async () => {
    rmSync(out, { recursive: true, force: true })
    mkdirSync(out, { recursive: true })
    await ejectComponents({ names: components, cwd: root, uiRoot: root, dir: out })
  })
  afterAll(() => rmSync(out, { recursive: true, force: true }))

  it('ejects every available component', () => {
    expect(components.length).toBeGreaterThan(0)
    expect(readdirSync(out).sort()).toEqual([...components].sort())
  })

  it('only leaves same-dir relative, ui package, or npm imports; named ui imports exist', () => {
    const exported = new Set(Object.keys(ui))
    for (const file of walk(out).filter((f) => /\.(ts|vue)$/.test(f))) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)(['"])([^'"]+)\1/g)) {
        const spec = m[2]
        expect(spec.startsWith('../'), `${file}: ${spec}`).toBe(false)
      }
      for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]@nineh2303\/ui['"]/g)) {
        const isType = /import\s+type/.test(m[0])
        if (isType) continue
        for (const raw of m[1].split(',')) {
          const name = raw.trim().replace(/^type\s+.*/, '').split(/\s+as\s+/)[0].trim()
          if (name) expect(exported.has(name), `${file}: ${name}`).toBe(true)
        }
      }
    }
  })

  it('every ejected index compiles and exports the same names as the source', async () => {
    for (const name of components) {
      const ejected = await load(name)
      const original = await import(`../src/components/${name}/index.ts`)
      expect(Object.keys(ejected).sort()).toEqual(Object.keys(original).sort())
    }
  }, 60_000)

  it('renders ejected Button and Dialog', async () => {
    const { Button } = await load('button')
    const w = mount(Button, { slots: { default: 'Hi' } })
    expect(w.text()).toBe('Hi')
    const { Dialog, DialogTrigger } = await load('dialog')
    const d = mount({ components: { Dialog, DialogTrigger }, template: '<Dialog><DialogTrigger>open</DialogTrigger></Dialog>' })
    expect(d.text()).toContain('open')
  })
})
