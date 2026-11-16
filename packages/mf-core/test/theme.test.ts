import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTheme } from '../src/theme/theme'

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
})
