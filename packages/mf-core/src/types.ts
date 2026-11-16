export interface RemoteEntry {
  name: string
  entry: string
  routePrefix: string
  critical?: boolean
  menu?: { label: string; order?: number }
}

export interface RemotesManifest {
  remotes: RemoteEntry[]
}

export interface RemoteMeta {
  name: string
  coreVersion: string
}

import type { App, Ref } from 'vue'
import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import type { AxiosInstance } from 'axios'
import type { I18n } from './i18n/i18n'
import type { MfBus } from './bus/bus'
import type { AuthApi } from './auth/useAuth'

export type LoadedRemote = RemoteEntry & {
  status: 'loading' | 'ready' | 'error'
  error?: Error
}

export interface MfContext {
  app: App
  pinia: Pinia
  router: Router
  i18n: I18n
  bus: MfBus
  auth: AuthApi
  http: AxiosInstance
  remotes: Ref<LoadedRemote[]>
}

export type RemoteSetup = (ctx: MfContext) => void | Promise<void>
