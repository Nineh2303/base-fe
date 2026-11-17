import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compile } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const hasDist = existsSync(resolve(here, '../dist/index.js'))

// Compile as a consumer would: resolve through node_modules/@nineh-fe-base/ui (workspace symlink).
async function build(entry: 'host' | 'remote', extra: string[] = []) {
  const compiler = await compile(`@import '@nineh-fe-base/ui/styles/${entry}.css';`, {
    base: repoRoot,
    onDependency: () => {},
  })
  const scanner = new Scanner({ sources: compiler.sources })
  const candidates = [...scanner.scan(), ...extra]
  const css = compiler.build(candidates).replace(/^\/\*![\s\S]*?\*\/\s*/, '')
  return { css, candidates, sources: compiler.sources }
}

// Tailwind may emit `@layer properties;` (its @property fallback) before our statement; that is harmless
// as long as our order statement precedes every real layer block.
function expectLayerOrderFirst(css: string) {
  const order = css.indexOf('@layer theme, base, components, utilities;')
  expect(order).toBeGreaterThanOrEqual(0)
  expect(css.slice(0, order)).not.toMatch(/@layer\s+(theme|base|components|utilities)\s*\{/)
  expect(css.indexOf('@layer theme {')).toBeGreaterThan(order)
  expect(css.indexOf('@layer utilities {')).toBeGreaterThan(order)
}

describe.skipIf(!hasDist)('styles compile through tailwind', () => {
  it('host: layer order first, preflight present', async () => {
    const { css } = await build('host')
    expectLayerOrderFirst(css)
    expect(css).toMatch(/box-sizing:\s*border-box/)
    expect(css).toMatch(/@layer base/)
  })

  it('remote: layer order first, no preflight', async () => {
    const { css } = await build('remote')
    expectLayerOrderFirst(css)
    expect(css).not.toMatch(/box-sizing:\s*border-box/)
  })

  it('@source ../dist picks up classes only used inside ui components', async () => {
    for (const entry of ['host', 'remote'] as const) {
      const { css, candidates } = await build(entry)
      expect(candidates).toContain('bg-primary')
      expect(css).toMatch(/\.bg-primary\s*\{[^}]*background-color:\s*var\(--mf-color-primary\)/)
      expect(css).toMatch(/\.text-primary-foreground\s*\{[^}]*var\(--mf-color-primary-foreground\)/)
    }
  })

  it('tokens: dark variant, radius and font mapping', async () => {
    const { css } = await build('remote', ['dark:bg-card', 'rounded-md', 'rounded-lg', 'rounded-sm', 'rounded-xl', 'font-sans'])
    expect(css).toContain('.dark\\:bg-card:where([data-theme=dark], [data-theme=dark] *)')
    expect(css).toContain('var(--mf-color-card)')
    expect(css).toContain('calc(var(--mf-radius) - 2px)')
    expect(css).toContain('calc(var(--mf-radius) - 4px)')
    expect(css).toContain('calc(var(--mf-radius) + 4px)')
    expect(css).toMatch(/\.rounded-lg\s*\{[^}]*var\(--mf-radius\)/)
    expect(css).toMatch(/\.font-sans\s*\{[^}]*font-family:\s*var\(--mf-font-family\)/)
  })
})
