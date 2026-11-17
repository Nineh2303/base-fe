import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as src from '../src'

const here = dirname(fileURLToPath(import.meta.url))
const componentsDir = resolve(here, '../src/components')
const distIndex = resolve(here, '../dist/index.js')
const hasDist = existsSync(distIndex)

const dirs = readdirSync(componentsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)

function barrelNames(dir: string): string[] {
  const text = readFileSync(resolve(componentsDir, dir, 'index.ts'), 'utf8')
  const names: string[] = []
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop()!.trim()
      if (n && !n.startsWith('type ')) names.push(n)
    }
  }
  for (const m of text.matchAll(/export\s+\*\s+from\s+'([^']+)'/g)) {
    // `export * from './x'` re-exports a module; resolve one level for ts files.
    const f = resolve(componentsDir, dir, `${m[1]}.ts`)
    if (existsSync(f)) for (const e of readFileSync(f, 'utf8').matchAll(/export\s+(?:const|function)\s+(\w+)/g)) names.push(e[1])
  }
  return names
}

describe('export surface', () => {
  it('every component barrel exports every .vue file in its folder (no orphan components)', () => {
    for (const d of dirs) {
      const vue = readdirSync(resolve(componentsDir, d)).filter((f) => f.endsWith('.vue')).map((f) => f.replace(/\.vue$/, ''))
      const names = barrelNames(d)
      for (const v of vue) expect(names, `${d}/${v}.vue missing from ${d}/index.ts`).toContain(v)
    }
  })

  it('src/index.ts re-exports every component barrel', () => {
    const index = readFileSync(resolve(here, '../src/index.ts'), 'utf8')
    for (const d of dirs) expect(index, `src/index.ts must export ./components/${d}`).toContain(`'./components/${d}'`)
  })

  it('every barrel name is a defined runtime export of the package', () => {
    const exported = new Set(Object.keys(src))
    for (const d of dirs) for (const n of barrelNames(d)) expect(exported.has(n), `${n} (components/${d}) not exported by src/index`).toBe(true)
  })

  it('the package exports nothing beyond barrels + cn + usePortalTo', () => {
    const expected = new Set<string>(['cn', 'usePortalTo'])
    for (const d of dirs) for (const n of barrelNames(d)) expected.add(n)
    const extra = Object.keys(src).filter((k) => !expected.has(k))
    expect(extra).toEqual([])
  })

  it('exported components are all usable component objects, helpers are functions', () => {
    for (const [k, v] of Object.entries(src)) {
      if (/Variants$/.test(k) || k === 'cn' || k === 'usePortalTo' || k === 'toast') expect(typeof v, k).toBe('function')
      else expect(typeof v === 'object' && v !== null, `${k} should be a component object`).toBe(true)
    }
  })
})

describe.skipIf(!hasDist)('built dist matches src', () => {
  it('dist/index.js exports exactly the same names as src (no missing, no extra)', async () => {
    const dist = await import(/* @vite-ignore */ pathToFileURL(distIndex).href)
    expect(Object.keys(dist).sort()).toEqual(Object.keys(src).sort())
  })
})
