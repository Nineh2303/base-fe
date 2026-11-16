import axios from 'axios'
import { DEFAULT_ENDPOINTS, type AuthAdapter, type AuthEndpoints, type AuthUser } from '../types'

export interface CookieAdapterOptions {
  baseURL: string
  endpoints?: Partial<AuthEndpoints>
}

export function cookieAdapter(opts: CookieAdapterOptions): AuthAdapter {
  const endpoints = { ...DEFAULT_ENDPOINTS, ...opts.endpoints }
  const client = axios.create({ baseURL: opts.baseURL, withCredentials: true })

  return {
    withCredentials: true,
    async login(credentials) {
      const { data } = await client.post<{ user: AuthUser } | AuthUser>(endpoints.login, credentials)
      return 'user' in data && data.user ? (data.user as AuthUser) : (data as AuthUser)
    },
    async logout() {
      await client.post(endpoints.logout)
    },
    async refresh() {
      try {
        await client.post(endpoints.refresh)
        return true
      } catch {
        return false
      }
    },
    async fetchUser() {
      try {
        const { data } = await client.get<AuthUser>(endpoints.me)
        return data
      } catch {
        return null
      }
    },
    getAccessToken: () => null,
  }
}
