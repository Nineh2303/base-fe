import { createApp, defineComponent, h } from 'vue'
import type { App, Component } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw, RouterHistory } from 'vue-router'
import { createBus } from '../bus/bus'
import { createTheme, DEFAULT_TOKENS } from '../theme/theme'
import { createMfI18n } from '../i18n/i18n'
import { createHttpClient } from '../http/createHttpClient'
import type { AuthAdapter } from '../auth/types'
import { configureAuth, useAuthStore } from '../auth/store'
import { useAuth } from '../auth/useAuth'
import { installAuthGuard } from '../auth/guard'
import { loadManifest } from '../remotes/manifest'
import type { ManifestSource } from '../remotes/manifest'
import { createRemoteLoader } from '../remotes/loader'
import type { FederationRuntime } from '../remotes/loader'
import { MF_CONTEXT_KEY } from './context'
import type { MfContext } from '../types'

export interface MfAppOptions {
  /** Root layout; must contain a `<RouterView>`. */
  root: Component
  /** Host routes (home, 403, 404…). A route named `not-found` is reused for unknown paths. */
  routes?: RouteRecordRaw[]
  /** Remote manifest; omitted → no remotes. */
  remotes?: ManifestSource
  auth: AuthAdapter
  /**
   * `ctx.http` config. The Bearer token (and 401 refresh) is only sent to relative URLs, the `baseURL`
   * origin and `trustedOrigins`.
   */
  api: { baseURL: string; trustedOrigins?: string[] }
  /** Default `/auth/login`. */
  loginPath?: string
  /** Default `/403`. */
  forbiddenPath?: string
  theme?: Parameters<typeof createTheme>[0]
  i18n?: Parameters<typeof createMfI18n>[0]
  /** Default `createWebHistory()`. */
  history?: RouterHistory
  /** Federation runtime (tests inject a fake). */
  runtime?: FederationRuntime
}

export interface MfAppHandle {
  app: App
  ctx: MfContext
  /** Loads remotes, finishes the first navigation, then mounts. Resolves once rendered. */
  mount(el: string | Element): Promise<void>
}

const PREFIX = '[mf-core]'

const BuiltinNotFound = defineComponent({
  name: 'MfNotFound',
  setup() {
    return () => h('div', { class: 'mf-not-found', role: 'alert' }, [h('h1', '404'), h('p', 'Page not found')])
  },
})

function notFoundRoute(hostRoutes: RouteRecordRaw[]): RouteRecordRaw {
  const path = '/:pathMatch(.*)*'
  const host = hostRoutes.find((r) => r.name === 'not-found')
  if (host?.component) return { path, name: 'mf-not-found', component: host.component, meta: host.meta }
  if (host) return { path, name: 'mf-not-found', redirect: { name: 'not-found' } }
  return { path, name: 'mf-not-found', component: BuiltinNotFound }
}

export async function createMfApp(opts: MfAppOptions): Promise<MfAppHandle> {
  const loginPath = opts.loginPath ?? '/auth/login'
  const adapter = opts.auth
  const hostRoutes = opts.routes ?? []

  const app = createApp(opts.root)
  const pinia = createPinia()
  app.use(pinia)

  const bus = createBus()
  configureAuth(adapter, bus)
  createTheme(opts.theme ?? { tokens: DEFAULT_TOKENS })
  const i18n = createMfI18n(opts.i18n)
  app.use(i18n)

  // Created now, installed (app.use) only after remotes are registered so the initial
  // navigation already sees remote routes.
  const router = createRouter({ history: opts.history ?? createWebHistory(), routes: hostRoutes })
  installAuthGuard(router, { loginPath, forbiddenPath: opts.forbiddenPath })

  const store = app.runWithContext(() => useAuthStore())
  const auth = app.runWithContext(() => useAuth())

  const http = createHttpClient({
    baseURL: opts.api.baseURL,
    trustedOrigins: opts.api.trustedOrigins,
    withCredentials: adapter.withCredentials,
    auth: {
      getAccessToken: () => adapter.getAccessToken(),
      refresh: () => store.refresh(),
      onAuthFailure: async () => {
        try {
          await store.logout()
        } catch (err) {
          console.error(`${PREFIX} logout after auth failure failed:`, err)
        }
        const current = router.currentRoute.value
        if (current.path === loginPath) return
        await router.push({ path: loginPath, query: { redirect: current.fullPath } })
      },
    },
  })

  // ctxRef is only called from loadAll (during mount), after ctx is initialised.
  const loader = createRemoteLoader({ runtime: opts.runtime, router, ctxRef: () => ctx })
  const ctx: MfContext = { app, pinia, router, i18n, bus, auth, http, remotes: loader.remotes }
  app.provide(MF_CONTEXT_KEY, ctx)

  async function loadRemotes(): Promise<void> {
    if (!opts.remotes) return loader.loadAll([])
    const { remotes, errors } = await loadManifest(opts.remotes)
    for (const message of errors) {
      console.error(`${PREFIX} Remote manifest: ${message}`)
      bus.emit('notify', { type: 'error', message: `Remote manifest: ${message}` })
    }
    return loader.loadAll(remotes)
  }

  let mounting: Promise<void> | null = null
  function mount(el: string | Element): Promise<void> {
    if (mounting) return mounting
    mounting = (async () => {
      // Not awaited: the auth guard waits for init during the first navigation.
      void auth.init()
      await loadRemotes()
      await loader.ready
      router.addRoute(notFoundRoute(hostRoutes))
      app.use(router)
      await router.isReady()
      app.mount(el)
    })()
    return mounting
  }

  return { app, ctx, mount }
}
