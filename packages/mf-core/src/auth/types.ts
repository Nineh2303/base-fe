export interface AuthUser {
  id: string
  name: string
  permissions: string[]
  [k: string]: unknown
}

export interface AuthAdapter {
  login(credentials: Record<string, unknown>): Promise<AuthUser>
  logout(): Promise<void>
  refresh(): Promise<boolean>
  /** Restore the session on startup. */
  fetchUser(): Promise<AuthUser | null>
  /** Cookie adapter always returns null. */
  getAccessToken(): string | null
  /** Cookie adapter = true. */
  withCredentials?: boolean
}

export interface AuthEndpoints {
  login: string
  refresh: string
  logout: string
  me: string
}

export const DEFAULT_ENDPOINTS: AuthEndpoints = {
  login: '/auth/login',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  me: '/auth/me',
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous'
