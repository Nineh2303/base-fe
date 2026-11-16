import type { AuthAdapter, AuthUser } from '../types'

const DEFAULT_USER: AuthUser = { id: 'mock-1', name: 'Mock User', permissions: ['*'] }

export function createMockAuthAdapter(opts: { user?: AuthUser; autoLogin?: boolean } = {}): AuthAdapter {
  const user = opts.user ?? DEFAULT_USER
  let loggedIn = opts.autoLogin ?? false
  return {
    async login() {
      loggedIn = true
      return user
    },
    async logout() {
      loggedIn = false
    },
    async refresh() {
      return loggedIn
    },
    async fetchUser() {
      return loggedIn ? user : null
    },
    getAccessToken: () => (loggedIn ? 'mock-token' : null),
  }
}
