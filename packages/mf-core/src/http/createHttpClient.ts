import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Skip attaching the Authorization header (and 401 refresh handling). */
    skipAuth?: boolean
  }
  interface InternalAxiosRequestConfig {
    /** Internal marker: request was already replayed after a refresh. */
    _retried?: boolean
  }
}

export interface HttpAuthHooks {
  getAccessToken(): string | null
  refresh(): Promise<boolean>
  onAuthFailure(): void | Promise<void>
}

export function createHttpClient(
  config: Omit<AxiosRequestConfig, 'auth'> & { auth?: HttpAuthHooks; withCredentials?: boolean } = {},
): AxiosInstance {
  const { auth, ...axiosConfig } = config
  const http = axios.create(axiosConfig)
  if (config.withCredentials !== undefined) http.defaults.withCredentials = config.withCredentials

  let refreshing: Promise<boolean> | null = null

  // One shared refresh per failure cycle; onAuthFailure runs inside it, so exactly once.
  const refreshOnce = (hooks: HttpAuthHooks): Promise<boolean> => {
    if (!refreshing) {
      refreshing = (async () => {
        let ok: boolean
        try {
          ok = await hooks.refresh()
        } catch {
          ok = false
        }
        if (!ok) await hooks.onAuthFailure()
        return ok
      })().finally(() => {
        refreshing = null
      })
    }
    return refreshing
  }

  http.interceptors.request.use((req) => {
    if (auth && !req.skipAuth) {
      const token = auth.getAccessToken()
      if (token) req.headers.set('Authorization', `Bearer ${token}`)
    }
    return req
  })

  http.interceptors.response.use(undefined, async (error) => {
    const original = error?.config as InternalAxiosRequestConfig | undefined
    if (!auth || !original || error.response?.status !== 401 || original.skipAuth || original._retried) {
      throw error
    }
    // Token already rotated since this request was sent (late 401 from a stale token): just replay.
    const current = auth.getAccessToken()
    const sent = original.headers?.get?.('Authorization')
    const stale = !!current && sent !== `Bearer ${current}`
    if (!stale) {
      const ok = await refreshOnce(auth)
      if (!ok) throw error
    }
    original._retried = true
    return http.request(original)
  })

  return http
}
