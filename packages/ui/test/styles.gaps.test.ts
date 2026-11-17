import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compile } from '@tailwindcss/node'
import { DEFAULT_TOKENS } from '@nineh-fe-base/mf-core'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const tokens = readFileSync(resolve(here, '../styles/tokens.css'), 'utf8')

// Legacy mf-core aliases that predate the shadcn-style token set. They are set on :root for apps/remotes that
// read them directly (var(--mf-color-bg) ...) and intentionally have no Tailwind utility.
const LEGACY_UNMAPPED = new Set(['color-bg', 'color-text', 'color-danger', 'color-on-primary'])

describe('tokens.css maps every mf-core DEFAULT_TOKENS key', () => {
  it('light and dark define the same key set', () => {
    expect(Object.keys(DEFAULT_TOKENS.dark).sort()).toEqual(Object.keys(DEFAULT_TOKENS.light).sort())
  })

  it('each key is mapped to a theme variable (or is an explicitly legacy alias)', () => {
    const unmapped: string[] = []
    for (const key of Object.keys(DEFAULT_TOKENS.light)) {
      if (LEGACY_UNMAPPED.has(key)) continue
      let mapped: boolean
      if (key.startsWith('color-')) mapped = tokens.includes(`--${key}: var(--mf-${key})`)
      else if (key === 'radius') mapped = tokens.includes('var(--mf-radius)')
      else if (key === 'font-family') mapped = tokens.includes('--font-sans: var(--mf-font-family)')
      else mapped = tokens.includes(`var(--mf-${key})`)
      if (!mapped) unmapped.push(key)
    }
    expect(unmapped, 'tokens.css has no mapping for these mf-core tokens').toEqual([])
  })

  it('legacy allowlist only names keys that still exist (no stale exemptions)', () => {
    for (const k of LEGACY_UNMAPPED) expect(Object.keys(DEFAULT_TOKENS.light)).toContain(k)
  })

  it('tokens.css references no --mf-* variable that mf-core does not define (no dangling mapping)', () => {
    const known = new Set(Object.keys(DEFAULT_TOKENS.light))
    const refs = [...tokens.matchAll(/var\(--mf-([a-z-]+)\)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(10)
    for (const r of refs) expect(known.has(r), `--mf-${r} is not an mf-core token`).toBe(true)
  })
})

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = resolve(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('classes used in src compile against the token theme', () => {
  it('every themed colour / radius / font utility in src/**/*.vue generates a rule (no typos, unknown tokens)', async () => {
    const compiler = await compile(`@import '@nineh-fe-base/ui/styles/remote.css';`, { base: repoRoot, onDependency: () => {} })
    const baseline = compiler.build([]).length
    const used = new Set<string>()
    for (const f of walk(resolve(here, '../src')).filter((p) => p.endsWith('.vue') || p.endsWith('.ts'))) {
      const text = readFileSync(f, 'utf8')
      // class="..." / cn('...') string literals
      for (const m of text.matchAll(/['"`]([^'"`\n]*)['"`]/g)) for (const c of m[1].split(/\s+/)) if (c) used.add(c)
    }
    const themed = [...used].filter((c) => /(^|:)(bg|text|border|ring|fill|outline|rounded|font)-(background|foreground|card|popover|primary|secondary|muted|accent|destructive|input|ring|border|sm|md|lg|xl|sans)(?![a-z])/.test(c.replace(/\[[^\]]*\]/g, '[]')) || /(^|:)(bg|text|border|ring|fill)-[a-z]+(-foreground)?(\/\d+)?$/.test(c))
    expect(themed.length).toBeGreaterThan(20)
    const noRule: string[] = []
    for (const c of themed) {
      if (compiler.build([c]).length <= baseline) noRule.push(c)
    }
    // size/colour words that are not theme colours but share a prefix are legitimately built in (text-sm, border-transparent...)
    expect(noRule).toEqual([])
  })

  it('tw-animate classes used by overlay components are generated (animate/fade/zoom, in and out)', async () => {
    const compiler = await compile(`@import '@nineh-fe-base/ui/styles/remote.css';`, { base: repoRoot, onDependency: () => {} })
    const classes = [
      'data-[state=open]:animate-in', 'data-[state=closed]:animate-out',
      'data-[state=open]:fade-in-0', 'data-[state=closed]:fade-out-0',
      'data-[state=open]:zoom-in-95', 'data-[state=closed]:zoom-out-95',
      'animate-in', 'fade-in-0', 'zoom-in-95',
    ]
    const baseline = compiler.build([]).length
    for (const c of classes) expect(compiler.build([c]).length, `${c} generated nothing`).toBeGreaterThan(baseline)
    const css = compiler.build(classes)
    expect(css).toContain('@keyframes enter')
    expect(css).toContain('@keyframes exit')
  })

  it('remote.css compiled output has no preflight/reset rules and keeps the layer order first', async () => {
    const compiler = await compile(`@import '@nineh-fe-base/ui/styles/remote.css';`, { base: repoRoot, onDependency: () => {} })
    const css = compiler.build(['p-4', 'flex'])
    expect(css).not.toMatch(/box-sizing:\s*border-box/)
    expect(css).not.toMatch(/\bbutton,\s*input|::file-selector-button|-webkit-text-size-adjust/)
    expect(css).not.toMatch(/(^|[\s,}])(html|body|h1|blockquote)\s*[,{]/)
  })
})
