import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRoute } from 'vue-router'

/**
 * `false` while the current route opts out of the app layout (`meta.mfLayout === false`,
 * e.g. the error page of a failed critical remote), so the root layout can hide its chrome.
 */
export function useMfLayout(): ComputedRef<boolean> {
  const route = useRoute()
  return computed(() => !route.matched.some((r) => r.meta.mfLayout === false))
}
