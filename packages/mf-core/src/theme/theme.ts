import { ref, type Ref } from 'vue'

export type ThemeMode = 'light' | 'dark'
export type ThemeTokens = Record<string, string>

export interface ThemeApi {
  mode: Ref<ThemeMode>
  setMode(m: ThemeMode): void
  setTokens(m: ThemeMode, t: ThemeTokens): void
}

export const DEFAULT_TOKENS: Record<ThemeMode, ThemeTokens> = {
  light: {
    'color-primary': '#2563eb',
    'color-bg': '#ffffff',
    'color-text': '#111827',
    'color-border': '#e5e7eb',
  },
  dark: {
    'color-primary': '#60a5fa',
    'color-bg': '#111827',
    'color-text': '#f9fafb',
    'color-border': '#374151',
  },
}

let current: ThemeApi | undefined

export function createTheme(opts: {
  tokens: Record<ThemeMode, ThemeTokens>
  defaultMode?: ThemeMode
  storageKey?: string
}): ThemeApi {
  const storageKey = opts.storageKey ?? 'mf-theme'
  const tokens: Record<ThemeMode, ThemeTokens> = {
    light: { ...opts.tokens.light },
    dark: { ...opts.tokens.dark },
  }

  let initial: ThemeMode = opts.defaultMode ?? 'light'
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored === 'light' || stored === 'dark') initial = stored
  } catch {
    // storage unavailable: keep default
  }

  const mode = ref<ThemeMode>(initial)

  function apply(): void {
    const el = document.documentElement
    for (const [k, v] of Object.entries(tokens[mode.value])) el.style.setProperty(`--mf-${k}`, v)
    el.setAttribute('data-theme', mode.value)
  }

  const api: ThemeApi = {
    mode,
    setMode(m) {
      mode.value = m
      try {
        localStorage.setItem(storageKey, m)
      } catch {
        // ignore
      }
      apply()
    },
    setTokens(m, t) {
      tokens[m] = { ...tokens[m], ...t }
      if (m === mode.value) apply()
    },
  }

  apply()
  current = api
  return api
}

export function useTheme(): ThemeApi {
  if (!current) throw new Error('[mf-core] theme not initialised: call createTheme() first')
  return current
}
