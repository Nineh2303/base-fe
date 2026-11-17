import mitt, { type Emitter } from 'mitt'
import type { AuthUser } from '../auth/types'

export type MfEvents = {
  'auth:login': { user: AuthUser }
  'auth:logout': void
  notify: { type: 'info' | 'success' | 'warning' | 'error'; message: string }
  [k: `${string}:${string}`]: unknown
}

export type MfBus = Emitter<MfEvents>

/**
 * A listener that throws (typically a remote's) must not break the emitter (e.g. `auth.login`)
 * nor starve the other listeners: errors are logged and delivery continues.
 */
export function createBus(): MfBus {
  const bus = mitt<MfEvents>()
  const emit = ((type: keyof MfEvents, event?: unknown) => {
    const run = (handlers: unknown, ...args: unknown[]) => {
      for (const h of [...((handlers as Array<(...a: unknown[]) => void>) ?? [])]) {
        try {
          h(...args)
        } catch (err) {
          console.error(`[mf-core] bus listener for "${String(type)}" threw`, err)
        }
      }
    }
    run(bus.all.get(type), event)
    run(bus.all.get('*'), type, event)
  }) as MfBus['emit']
  return { ...bus, emit }
}
