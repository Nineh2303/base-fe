import { computed, defineAsyncComponent, defineComponent, h, ref } from 'vue'
import type { Component, Ref } from 'vue'
import { RouterView } from 'vue-router'
import type { RouteRecordRaw, Router } from 'vue-router'
import RemoteBoundary from './RemoteBoundary.vue'
import RemoteErrorPage from './RemoteErrorPage.vue'
import { mfRuntime } from './runtime'
import type { FederationRuntime } from './runtime'
import { CORE_VERSION } from '../version'
import type { LoadedRemote, MfContext, RemoteEntry, RemoteMeta, RemoteSetup } from '../types'

export type { FederationRuntime } from './runtime'
export { mfRuntime } from './runtime'

export interface RemoteLoaderDeps {
  runtime?: FederationRuntime
  router: Router
  ctxRef: () => MfContext
  coreVersion?: string
  /** Max time a single remote may take to load before it is marked `error`. Default 10000; 0 disables. */
  timeoutMs?: number
}

export interface RemoteLoader {
  remotes: Ref<LoadedRemote[]>
  /** Loads the given remotes in parallel. Never rejects. */
  loadAll(entries: RemoteEntry[]): Promise<void>
  /** Resolves once the first `loadAll` has settled (success or failure). */
  ready: Promise<void>
}

const PREFIX = '[mf-core]'

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err))
}

/** Accepts both a bare value and an ES module namespace `{ default: value }`. */
function unwrap<T>(mod: unknown): T {
  if (mod !== null && typeof mod === 'object' && !Array.isArray(mod) && 'default' in mod) {
    return (mod as { default: T }).default
  }
  return mod as T
}

/**
 * Semver compatibility key (ruling R6): `major` when major >= 1, `0.minor` while major is 0,
 * because a 0.x minor bump is breaking.
 */
function compatKey(version: string): string {
  const [maj = '', min = ''] = version.trim().replace(/^[v=^~\s]+/, '').split(/[.+-]/)
  return maj === '0' ? `0.${min}` : maj
}

function checkMeta(meta: RemoteMeta | undefined, remote: string, hostVersion: string): void {
  if (!meta || typeof meta.coreVersion !== 'string') {
    throw new Error(`Remote "${remote}" exposes an invalid ./mf-meta (missing coreVersion)`)
  }
  const remoteKey = compatKey(meta.coreVersion)
  const hostKey = compatKey(hostVersion)
  if (remoteKey !== hostKey) {
    const kind = hostKey.startsWith('0.') && remoteKey.startsWith('0.') ? '0.x minor' : 'major'
    throw new Error(
      `Remote "${remote}" was built with mf-core ${meta.coreVersion} but the host runs ${hostVersion} (incompatible version: ${kind} version mismatch)`,
    )
  }
  if (meta.name && meta.name !== remote) {
    console.warn(`${PREFIX} Remote registered as "${remote}" reports its name as "${meta.name}"`)
  }
}

/** True when `err` says the requested expose does not exist (vs. a real failure inside it). */
function isMissingExpose(err: unknown, remote: string, expose: string): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes(`./${expose}`) || msg.includes(`${remote}/${expose}`)
}

/** Prefixes route names with `<remote>/`; top-level paths become relative to the remote prefix. Internal (also used by createStandaloneRemote). */
export function scopeRoute(route: RouteRecordRaw, remote: string, top: boolean): RouteRecordRaw {
  const out = { ...route } as RouteRecordRaw & { name?: unknown; redirect?: unknown; children?: RouteRecordRaw[] }
  const scoped = (n: string) => (n.startsWith(`${remote}/`) ? n : `${remote}/${n}`)
  if (top && typeof out.path === 'string') out.path = out.path.replace(/^\/+/, '')
  if (typeof out.name === 'string') out.name = scoped(out.name)
  const redirect = out.redirect as { name?: unknown } | undefined
  if (redirect && typeof redirect === 'object' && typeof redirect.name === 'string') {
    out.redirect = { ...redirect, name: scoped(redirect.name) }
  }
  if (Array.isArray(out.children)) out.children = out.children.map((c) => scopeRoute(c, remote, false))
  return out
}

export function remoteHost(name: string): Component {
  return defineComponent({
    name: 'MfRemoteHost',
    setup() {
      return () => h(RemoteBoundary, { name }, { default: () => h(RouterView) })
    },
  })
}

function reload(): void {
  window.location.reload()
}

function errorView(entry: RemoteEntry, error: Error): Component {
  const label = entry.menu?.label ?? entry.name
  return defineComponent({
    name: entry.critical ? 'MfRemoteCriticalError' : 'MfRemoteError',
    setup() {
      return () =>
        entry.critical
          ? h(RemoteErrorPage, { name: label, error, onRetry: reload })
          : h(RemoteBoundary, { name: label, error, onRetry: reload })
    },
  })
}

export function createRemoteLoader(deps: RemoteLoaderDeps): RemoteLoader {
  const runtime = deps.runtime ?? mfRuntime
  const hostVersion = deps.coreVersion ?? CORE_VERSION
  const { router } = deps
  const remotes = ref<LoadedRemote[]>([])
  const names = new Set<string>()
  const prefixes = new Set<string>()
  const timeoutMs = deps.timeoutMs ?? 10000

  let resolveReady!: () => void
  const ready = new Promise<void>((r) => (resolveReady = r))

  function setStatus(name: string, status: LoadedRemote['status'], error?: Error) {
    const i = remotes.value.findIndex((r) => r.name === name)
    if (i < 0) return
    const next: LoadedRemote = { ...remotes.value[i]!, status }
    if (error) next.error = error
    else delete next.error
    remotes.value[i] = next
  }

  async function loadSetup(name: string): Promise<RemoteSetup | null> {
    let mod: unknown
    try {
      mod = await runtime.load(`${name}/setup`)
    } catch (err) {
      if (isMissingExpose(err, name, 'setup')) return null
      throw err
    }
    const setup = unwrap<unknown>(mod)
    if (typeof setup !== 'function') throw new Error(`Remote "${name}" ./setup must export a function`)
    return setup as RemoteSetup
  }

  async function loadOne(entry: RemoteEntry, state: { aborted: boolean }): Promise<void> {
    const { name } = entry
    const stop = () => {
      if (state.aborted) throw new Error(`Remote "${name}" load was abandoned after timing out`)
    }
    runtime.register([{ name, entry: entry.entry }])
    checkMeta(unwrap<RemoteMeta>(await runtime.load(`${name}/mf-meta`)), name, hostVersion)
    stop()
    const routes = unwrap<unknown>(await runtime.load(`${name}/routes`))
    stop()
    if (!Array.isArray(routes)) throw new Error(`Remote "${name}" ./routes must export an array of routes`)
    const setup = await loadSetup(name)
    stop()
    if (setup) await setup(deps.ctxRef())
    stop()
    router.addRoute({
      path: entry.routePrefix,
      name,
      component: remoteHost(name),
      meta: { mfRemote: name },
      children: (routes as RouteRecordRaw[]).map((r) => scopeRoute(r, name, true)),
    })
  }

  function addErrorRoutes(entry: RemoteEntry, error: Error) {
    if (router.hasRoute(entry.name)) router.removeRoute(entry.name)
    router.addRoute({
      // `/:pathMatch(.*)*` is optional, so this also matches the bare prefix.
      path: `${entry.routePrefix}/:pathMatch(.*)*`,
      name: entry.name,
      component: errorView(entry, error),
      meta: entry.critical ? { mfRemote: entry.name, mfLayout: false } : { mfRemote: entry.name },
    })
  }

  /** Races `loadOne` against the timeout so a hanging remote cannot block `ready` forever. */
  function loadWithTimeout(entry: RemoteEntry): Promise<void> {
    const state = { aborted: false }
    const run = loadOne(entry, state)
    if (!(timeoutMs > 0) || !Number.isFinite(timeoutMs)) return run
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        state.aborted = true
        reject(new Error(`Remote "${entry.name}" did not load within ${timeoutMs}ms (timeout)`))
      }, timeoutMs)
    })
    run.catch(() => {}) // a late failure after the timeout is already reported
    return Promise.race([run, timeout]).finally(() => clearTimeout(timer))
  }

  async function loadAll(entries: RemoteEntry[]): Promise<void> {
    try {
      // Conflict check runs first, in manifest order: the first claimant wins.
      const accepted: RemoteEntry[] = []
      for (const e of entries) {
        const prefixKey = e.routePrefix.toLowerCase()
        if (names.has(e.name)) {
          console.warn(`${PREFIX} Duplicate remote name "${e.name}" (${e.entry}) skipped`)
          continue
        }
        if (prefixes.has(prefixKey)) {
          console.warn(`${PREFIX} Remote "${e.name}" skipped: routePrefix "${e.routePrefix}" is already used`)
          continue
        }
        names.add(e.name)
        prefixes.add(prefixKey)
        accepted.push(e)
      }
      remotes.value = [...remotes.value, ...accepted.map((e): LoadedRemote => ({ ...e, status: 'loading' }))]

      await Promise.allSettled(
        accepted.map(async (e) => {
          try {
            await loadWithTimeout(e)
            setStatus(e.name, 'ready')
          } catch (raw) {
            const err = toError(raw)
            console.error(`${PREFIX} Failed to load remote "${e.name}":`, err)
            try {
              addErrorRoutes(e, err)
            } catch (routeErr) {
              console.error(`${PREFIX} Could not register the error route for "${e.name}":`, routeErr)
            }
            setStatus(e.name, 'error', err)
          }
        }),
      )
    } catch (err) {
      console.error(`${PREFIX} Remote loading failed:`, err)
    } finally {
      resolveReady()
    }
  }

  return { remotes, loadAll, ready }
}

/**
 * Host-side widget from a remote: an async component wrapped in `RemoteBoundary`.
 * `id` is `'<remote>/<expose>'`, e.g. `'products/Widget'`. Retry re-requests the module.
 */
export function defineRemoteComponent(id: string, opts: { runtime?: FederationRuntime } = {}): Component {
  if (!/^[^/]+\/.+/.test(id)) throw new Error(`${PREFIX} defineRemoteComponent: id must look like "<remote>/<expose>", got "${id}"`)
  const runtime = opts.runtime ?? mfRuntime
  return defineComponent({
    name: 'MfRemoteComponent',
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      const attempt = ref(0)
      const inner = computed(() => {
        void attempt.value
        return defineAsyncComponent(() => runtime.load<unknown>(id).then((m) => unwrap<Component>(m)))
      })
      return () =>
        h(RemoteBoundary, { name: id, onRetry: () => attempt.value++ }, { default: () => h(inner.value, attrs, slots) })
    },
  })
}
