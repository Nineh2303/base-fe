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

function pageOrigin(): string | undefined {
  const o = typeof location !== 'undefined' ? location.origin : undefined
  return o && o !== 'null' ? o : undefined
}

function parseUrl(url: string, base?: string): URL | undefined {
  try {
    return new URL(url, base)
  } catch {
    return undefined
  }
}

const ABSOLUTE_URL = /^([a-z][a-z\d+\-.]*:)?\/\//i

export interface HttpClientOptions extends Omit<AxiosRequestConfig, 'auth'> {
  auth?: HttpAuthHooks
  withCredentials?: boolean
  /**
   * Extra origins (e.g. `https://api.example.com`) that receive the Bearer token and 401/refresh handling.
   * Relative URLs and URLs on the same origin as `baseURL` (or the page, without `baseURL`) are always trusted.
   */
  trustedOrigins?: string[]
}

export function createHttpClient(config: HttpClientOptions = {}): AxiosInstance {
  const { auth, trustedOrigins = [], ...axiosConfig } = config
  const extraOrigins = new Set(
    trustedOrigins.map((o) => parseUrl(o)?.origin).filter((o): o is string => !!o),
  )

  /** The token (and refresh handling) only goes to relative / same-origin-as-baseURL / trusted URLs. */
  // Trusted origin = the instance's configured baseURL (a per-request baseURL override is not trusted by itself).
  const isTrusted = (req: AxiosRequestConfig): boolean => {
    const page = pageOrigin()
    const resolveBase = (b?: string) => (b ? parseUrl(b, page)?.href : page)
    const homeBase = resolveBase(http.defaults.baseURL)
    const reqBase = resolveBase(req.baseURL)
    const url = req.url ?? ''
    let target: URL | undefined
    if (reqBase) target = parseUrl(url, reqBase)
    else if (ABSOLUTE_URL.test(url)) target = parseUrl(url)
    else return true // plain relative path with no resolvable base (non-browser): same origin by definition
    if (!target) return false
    if (extraOrigins.has(target.origin)) return true
    return !!homeBase && target.origin === new URL(homeBase).origin
  }
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
    if (auth && !req.skipAuth && isTrusted(req)) {
      const token = auth.getAccessToken()
      if (token) req.headers.set('Authorization', `Bearer ${token}`)
    }
    return req
  })

  http.interceptors.response.use(undefined, async (error) => {
    const original = error?.config as InternalAxiosRequestConfig | undefined
    if (!auth || !original || error.response?.status !== 401 || original.skipAuth || original._retried || !isTrusted(original)) {
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
