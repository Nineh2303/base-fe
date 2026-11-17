import { http, HttpResponse } from 'msw'

/**
 * Mock API for the playground (baseURL `/api`).
 *
 * Token store: MSW request handlers run in the page, not in the Service Worker, so an
 * in-memory store would be wiped by every reload and break session restore (the refresh
 * token kept by `jwtAdapter` in localStorage would be rejected). The issued tokens are
 * therefore persisted in localStorage of the page origin, next to the refresh token itself.
 */

export const ADMIN = { id: '1', name: 'Admin', permissions: ['products.read'] }

/** A signed-in user without `products.read`: exercises the /403 path. Login: viewer / viewer. */
export const VIEWER = { id: '2', name: 'Viewer', permissions: [] as string[] }

export const PRODUCTS = [
  { id: 1, name: 'Bàn phím', price: 500000 },
  { id: 2, name: 'Chuột', price: 250000 },
  { id: 3, name: 'Màn hình', price: 3500000 },
]

/** Tokens sent by the default standalone mock adapters of mf-core; always accepted. */
const STATIC_ACCESS_TOKENS = ['mock-token', 'at-standalone']

const STORE_KEY = 'playground-mocks/tokens'

interface TokenStore {
  seq: number
  access: string[]
  refresh: string[]
  /** token -> user id (absent = admin), so /me and refresh keep returning the user the token was issued to */
  owners?: Record<string, string>
}

function read(): TokenStore {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as TokenStore
      if (typeof s.seq === 'number' && Array.isArray(s.access) && Array.isArray(s.refresh)) return s
    }
  } catch {
    // corrupted or unavailable storage: start fresh
  }
  return { seq: 0, access: [], refresh: [] }
}

function write(s: TokenStore): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s))
  } catch {
    // ignore
  }
}

function issue(owner = '1'): { accessToken: string; refreshToken: string } {
  const s = read()
  s.seq += 1
  const pair = { accessToken: `at-${s.seq}`, refreshToken: `rt-${s.seq}` }
  s.owners = { ...s.owners, [pair.accessToken]: owner, [pair.refreshToken]: owner }
  s.access.push(pair.accessToken)
  s.refresh.push(pair.refreshToken)
  write(s)
  return pair
}

function revokeRefresh(token: unknown): boolean {
  const s = read()
  const i = typeof token === 'string' ? s.refresh.indexOf(token) : -1
  if (i < 0) return false
  s.refresh.splice(i, 1)
  write(s)
  return true
}

function ownerOf(token: unknown): string {
  return (typeof token === 'string' && read().owners?.[token]) || '1'
}

function bearer(request: Request): string | null {
  const m = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '')
  return m ? m[1]! : null
}

function isValidAccess(request: Request): boolean {
  const token = bearer(request)
  return token !== null && (STATIC_ACCESS_TOKENS.includes(token) || read().access.includes(token))
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json()
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const unauthorized = () => HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const { username, password } = await body(request)
    const user = username === 'admin' && password === 'admin' ? ADMIN : username === 'viewer' && password === 'viewer' ? VIEWER : null
    if (!user) return HttpResponse.json({ message: 'Sai tên đăng nhập hoặc mật khẩu' }, { status: 401 })
    return HttpResponse.json({ ...issue(user.id), user })
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    const { refreshToken } = await body(request)
    // Rotation: the old refresh token is single-use.
    const owner = ownerOf(refreshToken)
    if (!revokeRefresh(refreshToken)) return unauthorized()
    return HttpResponse.json(issue(owner))
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    const { refreshToken } = await body(request)
    revokeRefresh(refreshToken)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/auth/me', ({ request }) =>
    isValidAccess(request) ? HttpResponse.json(ownerOf(bearer(request)) === VIEWER.id ? VIEWER : ADMIN) : unauthorized(),
  ),

  http.get('/api/products', ({ request }) => (isValidAccess(request) ? HttpResponse.json(PRODUCTS) : unauthorized())),
]
