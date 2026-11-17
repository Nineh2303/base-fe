import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ejectComponents, rewriteImports } from '../src/eject'

const UI = "'@nineh-fe-base/ui'"
const none = new Set<string>()

describe('rewriteImports adversarial', () => {
  it('handles mixed quotes, export-star, multi-line, import type, dynamic, side-effect', () => {
    const src = [
      `import { cn } from "../../lib/utils"`,
      `export * from '../../lib/utils'`,
      `import {\n  a,\n  b,\n} from '../../lib/portal'`,
      `import type { X } from "../../lib/utils"`,
      `const m = () => import('../../lib/utils')`,
      `import '../../lib/side'`,
      `import { ok } from './local'`,
      `import { v } from 'reka-ui'`,
    ].join('\n')
    const out = rewriteImports(src, none)
    expect(out).not.toMatch(/\.\.\//)
    expect(out).toContain(`export * from ${UI}`)
    expect(out).toContain(`import { cn } from ${UI}`)
    expect(out).toContain(`from './local'`)
    expect(out).toContain(`from 'reka-ui'`)
  })

  it('rewrites inside <script setup> and plain <script> blocks', () => {
    const vue = `<script>\nimport { cn } from '../../lib/utils'\nexport default {}\n</script>\n<script setup lang="ts">\nimport { cn as c } from "../../lib/utils"\n</script>\n<template><div/></template>`
    expect(rewriteImports(vue, none)).not.toMatch(/\.\.\//)
  })

  it('keeps sibling relative imports for ejected siblings, including dynamic', () => {
    const out = rewriteImports(`import { Button } from '../button'\nconst x = import("../button/Button.vue")`, new Set(['button']))
    expect(out).toContain(`'../button'`)
    expect(out).toContain(`"../button/Button.vue"`)
  })
})

describe('ejectComponents adversarial', () => {
  let base: string
  let ui: string
  let cwd: string
  const put = (f: string, c: string) => {
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, c)
  }
  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'eject-adv-'))
    ui = join(base, 'ui')
    cwd = join(base, 'app')
    mkdirSync(cwd)
    put(join(ui, 'package.json'), '{}')
    put(join(ui, 'src/components/a/index.ts'), `export const a = 1`)
    put(join(ui, 'src/components/b/index.ts'), `export const b = 1`)
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('writes nothing when one of many files exists without --force', async () => {
    put(join(cwd, 'out/b/index.ts'), 'mine')
    await expect(ejectComponents({ names: ['a', 'b'], cwd, uiRoot: ui, dir: 'out' })).rejects.toThrow(/--force/)
    expect(existsSync(join(cwd, 'out/a'))).toBe(false)
  })

  it('writes nothing when an unknown name is mixed with valid ones', async () => {
    await expect(ejectComponents({ names: ['a', 'zzz'], cwd, uiRoot: ui, dir: 'out' })).rejects.toThrow(/Unknown/)
    expect(existsSync(join(cwd, 'out'))).toBe(false)
  })

  it('creates nested non-existent relative and absolute dirs', async () => {
    await ejectComponents({ names: ['a'], cwd, uiRoot: ui, dir: 'x/y/z' })
    expect(existsSync(join(cwd, 'x/y/z/a/index.ts'))).toBe(true)
    const abs = resolve(base, 'abs', 'deep', 'dir')
    await ejectComponents({ names: ['b'], cwd, uiRoot: ui, dir: abs })
    expect(readdirSync(abs)).toEqual(['b'])
  })
})
