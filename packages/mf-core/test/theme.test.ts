import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTheme, DEFAULT_TOKENS } from '../src/theme/theme'

const tokens = { light: { 'color-primary': '#00f' }, dark: { 'color-primary': '#88f' } }
const root = () => document.documentElement

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    root().removeAttribute('data-theme')
    root().removeAttribute('style')
    vi.restoreAllMocks()
  })
  it('applies light tokens by default', () => {
    createTheme({ tokens })
    expect(root().style.getPropertyValue('--mf-color-primary')).toBe('#00f')
    expect(root().getAttribute('data-theme')).toBe('light')
  })
  it('setMode switches tokens and persists', () => {
    const t = createTheme({ tokens })
    t.setMode('dark')
    expect(root().style.getPropertyValue('--mf-color-primary')).toBe('#88f')
    expect(root().getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('mf-theme')).toBe('dark')
  })
  it('restores mode from storage', () => {
    localStorage.setItem('mf-theme', 'dark')
    const t = createTheme({ tokens })
    expect(t.mode.value).toBe('dark')
  })
  it('survives storage errors', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('x') })
    const t = createTheme({ tokens })
    expect(t.mode.value).toBe('light')
    expect(() => t.setMode('dark')).not.toThrow()
    expect(root().getAttribute('data-theme')).toBe('dark')
  })
  it('setTokens updates active mode', () => {
    const t = createTheme({ tokens })
    t.setTokens('light', { 'color-primary': '#123' })
    expect(root().style.getPropertyValue('--mf-color-primary')).toBe('#123')
  })
  it('ignores invalid stored value and uses defaultMode', () => {
    localStorage.setItem('mf-theme', 'purple')
    const t = createTheme({ tokens, defaultMode: 'dark' })
    expect(t.mode.value).toBe('dark')
    expect(root().getAttribute('data-theme')).toBe('dark')
  })
  it('honours custom storageKey', () => {
    const t = createTheme({ tokens, storageKey: 'k' })
    t.setMode('dark')
    expect(localStorage.getItem('k')).toBe('dark')
    expect(localStorage.getItem('mf-theme')).toBeNull()
  })
  it('DEFAULT_TOKENS cover every token used by the error views (light + dark)', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const k of ['color-primary', 'color-bg', 'color-text', 'color-border', 'color-danger', 'color-on-primary', 'radius', 'font-family']) {
        expect(DEFAULT_TOKENS[mode][k], `${mode}.${k}`).toBeTruthy()
      }
    }
    expect(DEFAULT_TOKENS.light['color-danger']).toBe('#dc2626')
    expect(DEFAULT_TOKENS.light['color-on-primary']).toBe('#ffffff')
    expect(DEFAULT_TOKENS.light.radius).toBe('6px')
    expect(DEFAULT_TOKENS.light['font-family']).toBe('system-ui, sans-serif')
  })
})

describe('DEFAULT_TOKENS shadcn set', () => {
  const keys = [
    'color-primary', 'color-bg', 'color-text', 'color-border', 'color-danger', 'color-on-primary', 'radius', 'font-family',
    'color-background', 'color-foreground', 'color-card', 'color-card-foreground', 'color-popover', 'color-popover-foreground',
    'color-primary-foreground', 'color-secondary', 'color-secondary-foreground', 'color-muted', 'color-muted-foreground',
    'color-accent', 'color-accent-foreground', 'color-destructive', 'color-destructive-foreground', 'color-input', 'color-ring',
  ]
  const aliases: Array<[string, string]> = [
    ['color-bg', 'color-background'],
    ['color-text', 'color-foreground'],
    ['color-danger', 'color-destructive'],
    ['color-on-primary', 'color-primary-foreground'],
  ]
  it('DEFAULT_TOKENS has every shadcn key in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const k of keys) expect(DEFAULT_TOKENS[mode][k], `${mode}.${k}`).toEqual(expect.any(String))
      for (const [a, b] of aliases) expect(DEFAULT_TOKENS[mode][a], `${mode} ${a}=${b}`).toBe(DEFAULT_TOKENS[mode][b])
    }
  })
})
