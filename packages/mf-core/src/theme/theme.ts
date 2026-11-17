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
    'color-danger': '#dc2626',
    'color-on-primary': '#ffffff',
    'color-card': '#ffffff',
    'color-card-foreground': '#111827',
    'color-popover': '#ffffff',
    'color-popover-foreground': '#111827',
    'color-primary-foreground': '#ffffff',
    'color-secondary': '#f3f4f6',
    'color-secondary-foreground': '#111827',
    'color-muted': '#f3f4f6',
    'color-muted-foreground': '#6b7280',
    'color-accent': '#f3f4f6',
    'color-accent-foreground': '#111827',
    'color-destructive': '#dc2626',
    'color-destructive-foreground': '#ffffff',
    'color-input': '#e5e7eb',
    'color-ring': '#2563eb',
    'color-background': '#ffffff',
    'color-foreground': '#111827',
    radius: '6px',
    'font-family': 'system-ui, sans-serif',
  },
  dark: {
    'color-primary': '#60a5fa',
    'color-bg': '#111827',
    'color-text': '#f9fafb',
    'color-border': '#374151',
    'color-danger': '#f87171',
    'color-on-primary': '#111827',
    'color-card': '#1f2937',
    'color-card-foreground': '#f9fafb',
    'color-popover': '#1f2937',
    'color-popover-foreground': '#f9fafb',
    'color-primary-foreground': '#111827',
    'color-secondary': '#1f2937',
    'color-secondary-foreground': '#f9fafb',
    'color-muted': '#1f2937',
    'color-muted-foreground': '#9ca3af',
    'color-accent': '#1f2937',
    'color-accent-foreground': '#f9fafb',
    'color-destructive': '#f87171',
    'color-destructive-foreground': '#111827',
    'color-input': '#374151',
    'color-ring': '#60a5fa',
    'color-background': '#111827',
    'color-foreground': '#f9fafb',
    radius: '6px',
    'font-family': 'system-ui, sans-serif',
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

  let applied: string[] = []
  function apply(): void {
    const el = document.documentElement
    // Drop vars set for the previous mode that the new mode does not define.
    for (const k of applied) if (!(k in tokens[mode.value])) el.style.removeProperty(`--mf-${k}`)
    applied = Object.keys(tokens[mode.value])
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
