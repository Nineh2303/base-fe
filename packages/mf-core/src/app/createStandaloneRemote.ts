import { defineComponent, h } from 'vue'
import type { Component } from 'vue'
import { RouterView } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import type { AuthAdapter } from '../auth/types'
import { createMockAuthAdapter } from '../auth/adapters/mock'
import { remoteHost, scopeRoute } from '../remotes/loader'
import type { RemoteSetup } from '../types'
import { createMfApp } from './createMfApp'
import type { MfAppHandle, MfAppOptions } from './createMfApp'

export interface StandaloneRemoteOptions
  extends Partial<Pick<MfAppOptions, 'loginPath' | 'forbiddenPath' | 'theme' | 'i18n' | 'history'>> {
  /** Remote name; route names are prefixed `<name>/` exactly as when loaded by a host. */
  name: string
  /** Defaults to a bare `<RouterView>`. */
  root?: Component
  /** The remote's `./routes`. */
  routes: RouteRecordRaw[]
  routePrefix: string
  /** The remote's `./setup`, run once before mount. */
  setup?: RemoteSetup
  /** Default `createMockAuthAdapter({ autoLogin: true })`. */
  auth?: AuthAdapter
  api: MfAppOptions['api']
}

const DefaultRoot = defineComponent({
  name: 'MfStandaloneRoot',
  setup() {
    return () => h(RouterView)
  },
})

/** Runs a remote on its own (dev / standalone deploy) with the same routing and context as in a host. */
export async function createStandaloneRemote(opts: StandaloneRemoteOptions): Promise<MfAppHandle> {
  const { name, routes, setup, root, auth, routePrefix: rawPrefix, ...rest } = opts
  const routePrefix = rawPrefix.replace(/\/+$/, '')
  if (!routePrefix.startsWith('/')) {
    throw new Error(`[mf-core] createStandaloneRemote: routePrefix must start with "/" and not be the root, got "${rawPrefix}"`)
  }

  const handle = await createMfApp({
    ...rest,
    root: root ?? DefaultRoot,
    auth: auth ?? createMockAuthAdapter({ autoLogin: true }),
    routes: [
      { path: '/', redirect: routePrefix },
      {
        path: routePrefix,
        name,
        component: remoteHost(name),
        meta: { mfRemote: name },
        children: routes.map((r) => scopeRoute(r, name, true)),
      },
    ],
  })
  if (setup) await setup(handle.ctx)
  return handle
}
