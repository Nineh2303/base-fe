import mitt, { type Emitter } from 'mitt'
import type { AuthUser } from '../auth/types'

export type MfEvents = {
  'auth:login': { user: AuthUser }
  'auth:logout': void
  notify: { type: 'info' | 'success' | 'warning' | 'error'; message: string }
  [k: `${string}:${string}`]: unknown
}

export type MfBus = Emitter<MfEvents>

export function createBus(): MfBus {
  return mitt<MfEvents>()
}
