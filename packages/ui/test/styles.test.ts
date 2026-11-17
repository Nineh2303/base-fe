import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const read = (f: string) => readFileSync(resolve(here, '../styles', f), 'utf8')
const host = read('host.css')
const remote = read('remote.css')
const tokens = read('tokens.css')

const KEYS = [
  'primary', 'primary-foreground', 'background', 'foreground', 'card', 'card-foreground', 'popover',
  'popover-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground', 'accent',
  'accent-foreground', 'destructive', 'destructive-foreground', 'border', 'input', 'ring',
]

describe('styles', () => {
  it('both entries start with the layer order', () => {
    expect(host.trimStart().startsWith('@layer theme, base, components, utilities;')).toBe(true)
    expect(remote.trimStart().startsWith('@layer theme, base, components, utilities;')).toBe(true)
  })
  it('tokens map every key', () => {
    expect(tokens).toContain('--color-primary: var(--mf-color-primary)')
    expect(tokens).toContain('--color-background: var(--mf-color-background)')
    for (const k of KEYS) expect(tokens).toContain(`--color-${k}: var(--mf-color-${k})`)
    expect(tokens).toContain('--font-sans: var(--mf-font-family)')
    expect(tokens).toContain('var(--mf-radius)')
    expect(tokens).toContain('@theme inline')
  })
  it('has the dark variant', () => {
    expect(tokens).toContain('@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));')
  })
  it('only host imports preflight', () => {
    expect(host).toContain('tailwindcss/preflight')
    expect(remote).not.toContain('preflight')
  })
  it('both import tokens and source the ui dist', () => {
    for (const css of [host, remote]) {
      expect(css).toContain('./tokens.css')
      expect(css).toContain('@source "../dist"')
    }
  })
})
