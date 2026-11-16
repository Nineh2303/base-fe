import axios from 'axios'
import { DEFAULT_ENDPOINTS, type AuthAdapter, type AuthEndpoints, type AuthUser } from '../types'

export interface JwtAdapterOptions {
  baseURL: string
  endpoints?: Partial<AuthEndpoints>
  refreshTokenStorage?: 'localStorage' | 'sessionStorage' | 'memory'
  storageKey?: string
}

export function jwtAdapter(opts: JwtAdapterOptions): AuthAdapter {
  const endpoints = { ...DEFAULT_ENDPOINTS, ...opts.endpoints }
  const storageKind = opts.refreshTokenStorage ?? 'localStorage'
  const storageKey = opts.storageKey ?? 'mf-refresh-token'
  // Bare client: never goes through the app httpClient (avoids refresh deadlock).
  const client = axios.create({ baseURL: opts.baseURL })

  let accessToken: string | null = null
  let memoryRefresh: string | null = null

  const storage = (): Storage | null => {
    if (storageKind === 'memory') return null
    try {
      return storageKind === 'sessionStorage' ? sessionStorage : localStorage
    } catch {
      return null
    }
  }
  const getRefresh = (): string | null => {
    const s = storage()
    return s ? s.getItem(storageKey) : memoryRefresh
  }
  const setRefresh = (token: string | null) => {
    const s = storage()
    if (s) {
      if (token) s.setItem(storageKey, token)
      else s.removeItem(storageKey)
    } else {
      memoryRefresh = token
    }
  }
  const clear = () => {
    accessToken = null
    setRefresh(null)
  }

  return {
    async login(credentials) {
      const { data } = await client.post<{ accessToken: string; refreshToken?: string; user: AuthUser }>(
        endpoints.login,
        credentials,
      )
      accessToken = data.accessToken
      if (data.refreshToken) setRefresh(data.refreshToken)
      return data.user
    },
    async logout() {
      const refreshToken = getRefresh()
      try {
        await client.post(endpoints.logout, { refreshToken })
      } finally {
        clear()
      }
    },
    async refresh() {
      const refreshToken = getRefresh()
      if (!refreshToken) return false
      try {
        const { data } = await client.post<{ accessToken: string; refreshToken?: string }>(endpoints.refresh, {
          refreshToken,
        })
        accessToken = data.accessToken
        if (data.refreshToken) setRefresh(data.refreshToken)
        return true
      } catch (e) {
        // Network/5xx errors: keep the stored token, the session may still be valid.
        const status = axios.isAxiosError(e) ? e.response?.status : undefined
        if (status === 401 || status === 403 || status === 400) clear()
        return false
      }
    },
    async fetchUser() {
      if (!accessToken) return null
      try {
        const { data } = await client.get<AuthUser>(endpoints.me, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        return data
      } catch {
        return null
      }
    },
    getAccessToken: () => accessToken,
  }
}
