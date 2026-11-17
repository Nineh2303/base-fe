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
  // Web storage can throw (denied, quota): the in-memory copy is always kept as the fallback.
  const getRefresh = (): string | null => {
    const s = storage()
    if (!s) return memoryRefresh
    try {
      return s.getItem(storageKey)
    } catch {
      return memoryRefresh
    }
  }
  const setRefresh = (token: string | null) => {
    memoryRefresh = token
    const s = storage()
    if (!s) return
    try {
      if (token) s.setItem(storageKey, token)
      else s.removeItem(storageKey)
    } catch {
      // keep the in-memory copy
    }
  }
  // Bumped by login/logout/clear: a refresh that started before it must not write its result afterwards.
  let epoch = 0
  const clear = () => {
    epoch++
    accessToken = null
    setRefresh(null)
  }

  return {
    async login(credentials) {
      const { data } = await client.post<{ accessToken: string; refreshToken?: string; user: AuthUser }>(
        endpoints.login,
        credentials,
      )
      epoch++
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
      let refreshToken = getRefresh()
      const startEpoch = epoch
      // At most one retry: when another tab rotated the stored token while ours was in flight.
      for (let attempt = 0; refreshToken && attempt < 2; attempt++) {
        try {
          const { data } = await client.post<{ accessToken: string; refreshToken?: string }>(endpoints.refresh, {
            refreshToken,
          })
          if (epoch !== startEpoch) return false // logged out / re-logged in meanwhile: discard
          accessToken = data.accessToken
          if (data.refreshToken) setRefresh(data.refreshToken)
          return true
        } catch (e) {
          if (epoch !== startEpoch) return false
          // Network/5xx errors: keep the stored token, the session may still be valid.
          const status = axios.isAxiosError(e) ? e.response?.status : undefined
          if (status !== 401 && status !== 403 && status !== 400) return false
          const stored = getRefresh()
          if (stored === refreshToken) {
            clear()
            return false
          }
          // Another tab stored a newer token: never clear it; try it once.
          accessToken = null
          refreshToken = stored
        }
      }
      return false
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
