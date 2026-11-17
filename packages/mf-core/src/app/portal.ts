import { computed, inject } from 'vue'
import type { ComputedRef, InjectionKey, Ref } from 'vue'

/** Provided by RemoteBoundary: the `[data-mf-portal]` element inside the remote's scope (null until mounted). */
export const MF_PORTAL_KEY: InjectionKey<Ref<HTMLElement | null>> = Symbol.for('nineh-fe-base/ui-portal')

/** Teleport target for overlays: the scope's portal element once mounted, otherwise `'body'`. */
export function useMfPortalTarget(): ComputedRef<HTMLElement | string> {
  const portal = inject(MF_PORTAL_KEY, null)
  return computed(() => portal?.value ?? 'body')
}
