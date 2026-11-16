import { getInstance, init } from '@module-federation/runtime'
import type { ModuleFederation } from '@module-federation/runtime'

/** Minimal surface of the Module Federation runtime used by mf-core (injectable for tests). */
export interface FederationRuntime {
  register(remotes: { name: string; entry: string }[]): void
  load<T>(id: string): Promise<T>
}

const FALLBACK_HOST = '__mf_core_host__'

/**
 * Finds the federation instance to talk to.
 * 1. The instance bound to this copy of `@module-federation/runtime` — in a host built with
 *    `@module-federation/vite` the plugin's bootstrap calls `init()` on it, so it already exists.
 * 2. Any instance on `globalThis.__FEDERATION__` (the first one is the host's).
 * 3. Otherwise create one, so mf-core also works in a page without the plugin.
 */
function instance(): ModuleFederation {
  const own = getInstance()
  if (own) return own
  try {
    const global = getInstance(() => true)
    if (global) return global
  } catch {
    // __FEDERATION__ not initialised yet
  }
  return init({ name: FALLBACK_HOST, remotes: [] })
}

export const mfRuntime: FederationRuntime = {
  register(remotes) {
    instance().registerRemotes(
      remotes.map(({ name, entry }) =>
        // MF 2.0 manifests describe their own entry type; a bare remoteEntry.js from
        // @module-federation/vite is an ES module and must be imported, not script-injected.
        /mf-manifest\.json(\?.*)?$/.test(entry) ? { name, entry } : { name, entry, type: 'module' as const },
      ),
    )
  },
  async load<T>(id: string): Promise<T> {
    const mod = await instance().loadRemote<T>(id)
    // loadRemote resolves null when an errorLoadRemote plugin swallows the failure.
    if (mod == null) throw new Error(`[mf-core] Remote module "${id}" could not be loaded`)
    return mod
  },
}
