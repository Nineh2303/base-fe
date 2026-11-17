import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTheme, useTheme } from '../src/theme/theme'

const root = () => document.documentElement

describe('theme gaps', () => {
  beforeEach(() => {
    localStorage.clear()
    root().removeAttribute('data-theme')
    root().removeAttribute('style')
    vi.restoreAllMocks()
  })

  it('setTokens for the inactive mode does not touch the DOM until that mode becomes active', () => {
    const t = createTheme({ tokens: { light: { 'color-primary': '#00f' }, dark: { 'color-primary': '#88f' } } })
    t.setTokens('dark', { 'color-primary': '#999', 'color-extra': '#abc' })
    expect(root().style.getPropertyValue('--mf-color-primary')).toBe('#00f')
    expect(root().style.getPropertyValue('--mf-color-extra')).toBe('')
    t.setMode('dark')
    expect(root().style.getPropertyValue('--mf-color-primary')).toBe('#999')
    expect(root().style.getPropertyValue('--mf-color-extra')).toBe('#abc')
  })

  it('setTokens merges, keeping untouched tokens', () => {
    const t = createTheme({ tokens: { light: { a: '1', b: '2' }, dark: { a: '3', b: '4' } } })
    t.setTokens('light', { a: '9' })
    expect(root().style.getPropertyValue('--mf-a')).toBe('9')
    expect(root().style.getPropertyValue('--mf-b')).toBe('2')
  })

  it('createTheme copies the input tokens (later mutation of the caller object has no effect)', () => {
    const input = { light: { a: '1' }, dark: { a: '2' } }
    const t = createTheme({ tokens: input })
    input.dark.a = 'mutated'
    t.setMode('dark')
    expect(root().style.getPropertyValue('--mf-a')).toBe('2')
  })

  it('switching to a mode that lacks a token another mode defined does not leave the stale var', () => {
    const t = createTheme({ tokens: { light: { a: '1', 'only-light': 'x' }, dark: { a: '2' } } })
    expect(root().style.getPropertyValue('--mf-only-light')).toBe('x')
    t.setMode('dark')
    expect(root().style.getPropertyValue('--mf-only-light')).toBe('')
  })

  it('a localStorage getter that throws (storage blocked) keeps the default mode and setMode still works', () => {
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const t = createTheme({ tokens: { light: { a: '1' }, dark: { a: '2' } }, defaultMode: 'dark' })
    expect(t.mode.value).toBe('dark')
    expect(() => t.setMode('light')).not.toThrow()
    expect(root().getAttribute('data-theme')).toBe('light')
    spy.mockRestore()
  })

  it('useTheme returns the latest created theme', () => {
    const t = createTheme({ tokens: { light: {}, dark: {} } })
    expect(useTheme()).toBe(t)
  })

  it('setMode with the same mode is idempotent and still persists', () => {
    const t = createTheme({ tokens: { light: { a: '1' }, dark: { a: '2' } } })
    t.setMode('light')
    expect(localStorage.getItem('mf-theme')).toBe('light')
    expect(root().getAttribute('data-theme')).toBe('light')
  })
})
