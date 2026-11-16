import { createI18n } from 'vue-i18n'

function make(locale: string, fallbackLocale: string, messages: Record<string, object>) {
  return createI18n({ legacy: false, locale, fallbackLocale, messages: messages as Record<string, never> })
}

export type I18n = ReturnType<typeof make>

export function createMfI18n(opts: {
  locale?: string
  fallbackLocale?: string
  messages?: Record<string, object>
} = {}): I18n {
  return make(opts.locale ?? 'vi', opts.fallbackLocale ?? 'en', opts.messages ?? {})
}

export function registerMessages(
  i18n: I18n,
  namespace: string,
  messages: Record<string, object>,
): void {
  for (const [locale, msgs] of Object.entries(messages)) {
    i18n.global.mergeLocaleMessage(locale, { [namespace]: msgs } as never)
  }
}
