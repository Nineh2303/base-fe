import type { ComputedRef } from 'vue'
import { useMfPortalTarget } from '@nineh2303/mf-core'

/**
 * Teleport target for overlays: the enclosing remote's `[data-mf-portal]` element once mounted, else 'body'.
 * The value is reactive, so an overlay that is open at first render is moved into the scope as soon as the
 * portal element exists.
 */
export function usePortalTo(): ComputedRef<HTMLElement | string> {
  return useMfPortalTarget()
}
