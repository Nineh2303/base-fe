import { inject } from 'vue'
import type { InjectionKey } from 'vue'
import type { MfContext } from '../types'

export const MF_CONTEXT_KEY: InjectionKey<MfContext> = Symbol('mf-context')

export function useMfContext(): MfContext {
  const ctx = inject(MF_CONTEXT_KEY, null)
  if (!ctx) {
    throw new Error('MfContext not provided: call createMfApp() or provide(MF_CONTEXT_KEY, ctx) first')
  }
  return ctx
}
