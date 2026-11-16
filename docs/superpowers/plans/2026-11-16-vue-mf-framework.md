# Framework micro-frontend Vue (@nineh-fe-base) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây monorepo framework gồm `@nineh-fe-base/mf-vite`, `@nineh-fe-base/mf-core`, `@nineh-fe-base/create-mf` cùng playground `shell` / `auth-service` / `products-service` chứng minh luồng đăng nhập → gọi API có token → cô lập lỗi remote.

**Architecture:** `mf-vite` là Vite preset bọc `@module-federation/vite` với shared singleton cấu hình sẵn. `mf-core` là runtime dùng chung (auth + adapter, httpClient, bus, theme, i18n, remote loader đọc `remotes.json`, `createMfApp`, `createStandaloneRemote`) — chính nó cũng là shared singleton. Remote expose `./routes`, `./setup` (tùy chọn) và `./mf-meta` (tự sinh, chứa version mf-core lúc build) để host kiểm tra tương thích major.

**Tech Stack:** pnpm workspaces, TypeScript strict, Vue 3, Vite, `@module-federation/vite` + `@module-federation/runtime`, Pinia, Vue Router, vue-i18n, axios, mitt, Vitest + @vue/test-utils + jsdom + axios-mock-adapter, MSW (mock API), Playwright (e2e), tsup (build mf-vite, create-mf), vite lib mode + vite-plugin-dts (build mf-core), @clack/prompts (CLI), Changesets, ESLint (flat config) + Prettier.

**Spec:** `docs/superpowers/specs/2026-11-16-vue-mf-framework-design.md`

## Global Constraints

- Scope npm: `@nineh-fe-base`. Ba package: `@nineh-fe-base/mf-vite`, `@nineh-fe-base/mf-core`, `@nineh-fe-base/create-mf`.
- Version thư viện: bản stable mới nhất tại thời điểm cài (Task 1 chốt và ghi vào root `package.json`); Node ≥ 20, pnpm ≥ 9.
- Federation: chỉ `@module-federation/vite`; không dùng `@originjs/vite-plugin-federation`.
- Shared singleton bắt buộc: `vue`, `pinia`, `vue-router`, `vue-i18n`, `@nineh-fe-base/mf-core`. Không bao giờ được có 2 bản chạy cùng lúc.
- Trong package framework: `vue`/`pinia`/`vue-router`/`vue-i18n` là `peerDependencies`. Trong dự án host/remote (playground, template CLI) là dependency thường.
- Remote bundle fallback shared (không `import: false`) để chạy standalone.
- Không UI lib trong core; chỉ CSS variables tiền tố `--mf-`.
- Store id của remote có tiền tố tên remote: `<remote>/<store>` (vd `products/list`). Store của core: `mf-core/auth`.
- Lệch major `mf-core` giữa host và remote → từ chối tải remote, hiện lỗi rõ ràng.
- `publishConfig.registry`: `https://npm.pkg.github.com`. Chưa publish thật; workflow release viết sẵn.
- Playground dùng package qua `workspace:*`.
- Mọi commit kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ngôn ngữ: code/identifier tiếng Anh; README và message UI playground tiếng Việt được.

## Review Focus

1. **Nhiều request cùng nhận 401** → chỉ gọi refresh đúng 1 lần, các request chờ được phát lại; refresh thất bại → logout đúng 1 lần, chuyển tới login, không vòng lặp. (test ở Task 3)
2. **`remotes.json` không tải được hoặc sai định dạng** → shell vẫn khởi động, hiện thông báo lỗi, không trắng trang. (test ở Task 6)
3. **Reload trực tiếp ở deep link `/products`** trước khi route remote kịp đăng ký → router chờ remote đăng ký xong rồi mới resolve, không rơi vào 404. (test ở Task 7)
4. **Reload trang sau khi đăng nhập** → phiên được khôi phục (`init()` dùng refresh token đã lưu), không bị đá về login. (test ở Task 4)
5. **Hai remote khai báo trùng route name / routePrefix** → remote sau bị bỏ qua kèm cảnh báo console, remote trước vẫn chạy. (test ở Task 6)

---

## File Structure

```
/
├─ package.json                 root scripts: dev, build, test, lint, e2e, changeset
├─ pnpm-workspace.yaml          packages/*, playground/*
├─ tsconfig.base.json
├─ eslint.config.js, .prettierrc, .gitignore, .npmrc
├─ vitest.workspace.ts
├─ .changeset/config.json       fixed: [["@nineh-fe-base/*"]]
├─ .github/workflows/ci.yml, release.yml
├─ packages/
│  ├─ mf-vite/src/
│  │  ├─ index.ts               export defineHost, defineRemote, types
│  │  ├─ shared.ts              DEFAULT_SHARED, buildShared()
│  │  ├─ federation.ts          buildFederationOptions()
│  │  ├─ meta.ts                writeMetaModule()
│  │  └─ define.ts              defineHost(), defineRemote()
│  ├─ mf-core/src/
│  │  ├─ index.ts               public API
│  │  ├─ version.ts             CORE_VERSION (inject lúc build)
│  │  ├─ types.ts               MfContext, RemoteEntry, RemotesManifest, RemoteMeta, RemoteSetup
│  │  ├─ http/createHttpClient.ts
│  │  ├─ auth/types.ts, store.ts, useAuth.ts, guard.ts
│  │  ├─ auth/adapters/jwt.ts, cookie.ts, mock.ts
│  │  ├─ bus/bus.ts
│  │  ├─ theme/theme.ts
│  │  ├─ i18n/i18n.ts
│  │  ├─ remotes/manifest.ts    parseManifest(), loadManifest()
│  │  ├─ remotes/loader.ts      createRemoteLoader()
│  │  ├─ remotes/RemoteBoundary.vue, RemoteErrorPage.vue
│  │  ├─ app/context.ts         MF_CONTEXT_KEY, useMfContext()
│  │  ├─ app/createMfApp.ts
│  │  └─ app/createStandaloneRemote.ts
│  └─ create-mf/
│     ├─ src/index.ts           bin: prompts → generate()
│     ├─ src/generate.ts        generate()
│     └─ templates/host/, templates/remote/
└─ playground/
   ├─ mocks/                    @playground/mocks: MSW handlers + startMocks()
   ├─ shell/                    port 5000
   ├─ auth-service/             port 5001
   ├─ products-service/         port 5002
   └─ e2e/                      Playwright
```

---

### Task 1: Monorepo nền + `mf-vite`

**Files:**
- Create: toàn bộ file gốc ở trên (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `vitest.workspace.ts`, `.changeset/config.json`)
- Create: `packages/mf-vite/{package.json,tsconfig.json,tsup.config.ts}`, `packages/mf-vite/src/{index,shared,federation,meta,define}.ts`
- Test: `packages/mf-vite/test/federation.test.ts`, `packages/mf-vite/test/meta.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type SharedConfig = Record<string, { singleton?: boolean; requiredVersion?: string; eager?: boolean }>
  const DEFAULT_SHARED_NAMES = ['vue','pinia','vue-router','vue-i18n','@nineh-fe-base/mf-core'] as const
  function buildShared(versions: Record<string,string>, extra?: SharedConfig): SharedConfig
  interface HostOptions { name: string; port?: number; shared?: SharedConfig; vite?: UserConfig }
  interface RemoteOptions { name: string; port?: number; exposes: Record<string,string>; shared?: SharedConfig; vite?: UserConfig }
  function buildFederationOptions(kind: 'host'|'remote', opts: HostOptions|RemoteOptions, ctx: { root: string; versions: Record<string,string>; coreVersion: string }): FederationOptions
  function writeMetaModule(root: string, meta: { name: string; coreVersion: string }): string  // trả path file đã ghi
  function defineHost(opts: HostOptions): UserConfigFnPromise
  function defineRemote(opts: RemoteOptions): UserConfigFnPromise
  ```
  `versions` đọc từ `package.json` của dự án dùng preset (dependencies), `coreVersion` đọc từ `node_modules/@nineh-fe-base/mf-core/package.json`.

- [ ] **Step 1: Khởi tạo repo** — `git init`, tạo các file gốc; `pnpm-workspace.yaml` gồm `packages/*`, `playground/*`; root scripts: `dev` (`pnpm -r --parallel --filter "./playground/*" dev`), `build` (`pnpm -r build`), `test` (`vitest run`), `lint`, `e2e` (`pnpm --filter e2e test`). Changesets config `fixed: [["@nineh-fe-base/*"]]`, `access: "restricted"`, `baseBranch: "main"`. Cài devDeps gốc (typescript, vitest, eslint, prettier, @changesets/cli) bản mới nhất. Run: `pnpm install` → thành công.

- [ ] **Step 2: Viết test thất bại** `packages/mf-vite/test/federation.test.ts`:
  ```ts
  const ctx = { root: '/r', versions: { vue: '^3.5.0', pinia: '^3.0.0', 'vue-router': '^4.5.0', 'vue-i18n': '^11.0.0', '@nineh-fe-base/mf-core': 'workspace:*' }, coreVersion: '0.1.0' }
  test('host: shared singleton đủ 5 package', () => {
    const o = buildFederationOptions('host', { name: 'shell' }, ctx)
    for (const n of DEFAULT_SHARED_NAMES) expect(o.shared[n]).toMatchObject({ singleton: true })
    expect(o.shared.vue.requiredVersion).toBe('^3.5.0')
    expect(o.shared['@nineh-fe-base/mf-core'].requiredVersion).toBe('^0.1.0') // workspace:* → ^coreVersion
    expect(o.remotes).toEqual({}); expect(o.manifest).toBe(true)
  })
  test('remote: filename, exposes giữ nguyên + ./mf-meta tự thêm', () => {
    const o = buildFederationOptions('remote', { name: 'products', exposes: { './routes': './src/routes.ts' } }, ctx)
    expect(o.filename).toBe('remoteEntry.js')
    expect(o.exposes['./routes']).toBe('./src/routes.ts')
    expect(o.exposes['./mf-meta']).toMatch(/node_modules[\\/]\.nineh-mf[\\/]mf-meta\.js$/)
  })
  test('shared của dự án merge đè lên mặc định', () => {
    const o = buildFederationOptions('host', { name: 'shell', shared: { dayjs: { singleton: true } } }, ctx)
    expect(o.shared.dayjs).toEqual({ singleton: true }); expect(o.shared.vue).toBeDefined()
  })
  test('tên remote không hợp lệ (không phải identifier JS) → throw', () => {
    expect(() => buildFederationOptions('remote', { name: 'my-products', exposes: {} }, ctx)).toThrow(/name/)
  })
  ```
  `meta.test.ts`: `writeMetaModule(tmp, {name:'products', coreVersion:'1.2.3'})` ghi file có nội dung `export default {"name":"products","coreVersion":"1.2.3"}` tại `<tmp>/node_modules/.nineh-mf/mf-meta.js`.

- [ ] **Step 3: Chạy test** — `pnpm vitest run packages/mf-vite` → FAIL (module chưa tồn tại).

- [ ] **Step 4: Cài đặt** `shared.ts`, `federation.ts`, `meta.ts`, `define.ts`. `defineRemote` gọi `writeMetaModule` rồi trả config Vite gồm `@vitejs/plugin-vue`, `federation(buildFederationOptions(...))`, `server.port`/`preview.port`/`server.strictPort`, `server.origin` = `http://localhost:<port>` (để asset remote có URL tuyệt đối), `build.target: 'esnext'`; merge `opts.vite` bằng `mergeConfig`. Tên remote phải khớp `/^[A-Za-z_$][\w$]*$/`. `workspace:*` / `link:` / `file:` trong versions → `^<coreVersion>`.

- [ ] **Step 5: Chạy test** — `pnpm vitest run packages/mf-vite` → PASS; `pnpm --filter @nineh-fe-base/mf-vite build` → ra `dist/index.js` + `dist/index.d.ts`.

- [ ] **Step 6: Commit** — `chore: monorepo scaffold` (gồm cả `docs/superpowers/`) + `feat(mf-vite): defineHost/defineRemote preset`.

---

### Task 2: `mf-core` khung package + types + bus + theme + i18n

**Files:**
- Create: `packages/mf-core/{package.json,tsconfig.json,vite.config.ts}`, `src/{index,version,types}.ts`, `src/bus/bus.ts`, `src/theme/theme.ts`, `src/i18n/i18n.ts`
- Test: `packages/mf-core/test/{bus,theme,i18n}.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // version.ts — giá trị inject bằng vite `define: { __MF_CORE_VERSION__ }` từ package.json
  export const CORE_VERSION: string
  // types.ts
  interface RemoteEntry { name: string; entry: string; routePrefix: string; critical?: boolean; menu?: { label: string; order?: number } }
  interface RemotesManifest { remotes: RemoteEntry[] }
  interface RemoteMeta { name: string; coreVersion: string }
  interface MfContext { app: App; pinia: Pinia; router: Router; i18n: I18n; bus: MfBus; auth: AuthApi; http: AxiosInstance; remotes: Ref<LoadedRemote[]> }
  type RemoteSetup = (ctx: MfContext) => void | Promise<void>
  // bus.ts
  interface MfEvents { 'auth:login': { user: AuthUser }; 'auth:logout': void; 'notify': { type: 'info'|'success'|'warning'|'error'; message: string } ; [k: `${string}:${string}`]: unknown }
  type MfBus = Emitter<MfEvents>  // mitt
  function createBus(): MfBus
  // theme.ts
  type ThemeMode = 'light'|'dark'
  type ThemeTokens = Record<string, string>   // key không tiền tố, vd 'color-primary'
  function createTheme(opts: { tokens: Record<ThemeMode, ThemeTokens>; defaultMode?: ThemeMode; storageKey?: string /* 'mf-theme' */ }): ThemeApi
  interface ThemeApi { mode: Ref<ThemeMode>; setMode(m: ThemeMode): void; setTokens(m: ThemeMode, t: ThemeTokens): void }
  function useTheme(): ThemeApi
  const DEFAULT_TOKENS: Record<ThemeMode, ThemeTokens>
  // i18n.ts
  function createMfI18n(opts?: { locale?: string /* 'vi' */; fallbackLocale?: string /* 'en' */; messages?: Record<string, object> }): I18n
  function registerMessages(i18n: I18n, namespace: string, messages: Record<string, object>): void  // gộp dưới key namespace
  ```
  (`AuthUser`, `AuthApi`, `LoadedRemote` định nghĩa ở Task 4/6; ở task này khai báo trong `types.ts` dưới dạng import type để tránh vòng.)

- [ ] **Step 1: Test thất bại**
  - `bus.test.ts`: `emit('notify', {type:'info', message:'x'})` gọi handler đúng payload; `off` gỡ được.
  - `theme.test.ts`: `createTheme({ tokens: { light: {'color-primary':'#00f'}, dark: {'color-primary':'#88f'} } })` → `document.documentElement.style.getPropertyValue('--mf-color-primary') === '#00f'`, `data-theme="light"`; `setMode('dark')` → `#88f`, `localStorage['mf-theme']==='dark'`; tạo lại theme khi localStorage có `'dark'` → mode khởi đầu `dark`; localStorage ném lỗi (mock) → vẫn chạy với mode mặc định.
  - `i18n.test.ts`: `registerMessages(i18n, 'products', { vi: { title: 'Sản phẩm' } })` → `i18n.global.t('products.title') === 'Sản phẩm'`; register 2 namespace không đè nhau.
- [ ] **Step 2: Chạy** `pnpm vitest run packages/mf-core` → FAIL.
- [ ] **Step 3: Cài đặt** các file trên. `vite.config.ts` lib mode, entry `src/index.ts`, format `es`, external `vue|pinia|vue-router|vue-i18n|axios|mitt|@module-federation/runtime`, `vite-plugin-dts`. `package.json`: `type: module`, `exports` `.` → `dist/index.js` + types, `peerDependencies` vue/pinia/vue-router/vue-i18n/`@module-federation/runtime`, `dependencies` axios, mitt; `publishConfig: { registry: "https://npm.pkg.github.com" }`; `version: 0.1.0`.
- [ ] **Step 4: Chạy** test → PASS; `pnpm --filter @nineh-fe-base/mf-core build` → PASS.
- [ ] **Step 5: Commit** `feat(mf-core): package skeleton, bus, theme, i18n`.

---

### Task 3: `httpClient` với refresh single-flight

**Files:**
- Create: `packages/mf-core/src/http/createHttpClient.ts`
- Test: `packages/mf-core/test/http.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface HttpAuthHooks { getAccessToken(): string | null; refresh(): Promise<boolean>; onAuthFailure(): void | Promise<void> }
  function createHttpClient(config: AxiosRequestConfig & { auth?: HttpAuthHooks; withCredentials?: boolean }): AxiosInstance
  ```
  Request config hỗ trợ cờ `skipAuth?: boolean` (module augmentation của axios) để bỏ gắn token.

- [ ] **Step 1: Test thất bại** (axios-mock-adapter):
  - `gắn Authorization: Bearer <token>` khi `getAccessToken()` trả token; không gắn khi null hoặc `skipAuth`.
  - `401 → refresh() 1 lần → phát lại request với token mới → trả 200`.
  - **3 request song song cùng nhận 401 → `refresh` được gọi đúng 1 lần, cả 3 cùng thành công.**
  - **refresh trả false (hoặc throw) → `onAuthFailure` gọi đúng 1 lần dù 3 request song song, cả 3 reject với status 401.**
  - request đã phát lại mà vẫn 401 → không refresh lần 2 (không vòng lặp), reject.
  - Không có `auth` hook → 401 reject thẳng.
- [ ] **Step 2: Chạy** `pnpm vitest run packages/mf-core/test/http.test.ts` → FAIL.
- [ ] **Step 3: Cài đặt** — interceptor request gắn token; interceptor response: nếu 401 và chưa `_retried`, dùng một promise refresh dùng chung (reset về null khi settle) — thành công thì phát lại với `_retried: true`, thất bại thì gọi `onAuthFailure` qua cùng promise đó (chỉ 1 lần).
- [ ] **Step 4: Chạy** → PASS.
- [ ] **Step 5: Commit** `feat(mf-core): http client with single-flight refresh`.

---

### Task 4: Auth — adapters, store, `useAuth`, guard

**Files:**
- Create: `packages/mf-core/src/auth/{types,store,useAuth,guard}.ts`, `src/auth/adapters/{jwt,cookie,mock}.ts`
- Test: `packages/mf-core/test/auth/{jwt,cookie,store,guard}.test.ts`

**Interfaces:**
- Consumes: `createHttpClient` (Task 3), `MfBus` (Task 2).
- Produces:
  ```ts
  interface AuthUser { id: string; name: string; permissions: string[]; [k: string]: unknown }
  interface AuthAdapter {
    login(credentials: Record<string, unknown>): Promise<AuthUser>
    logout(): Promise<void>
    refresh(): Promise<boolean>
    fetchUser(): Promise<AuthUser | null>       // khôi phục phiên khi khởi động
    getAccessToken(): string | null             // cookie adapter luôn null
    withCredentials?: boolean                   // cookie adapter = true
  }
  interface AuthEndpoints { login: string; refresh: string; logout: string; me: string }
  const DEFAULT_ENDPOINTS: AuthEndpoints = { login: '/auth/login', refresh: '/auth/refresh', logout: '/auth/logout', me: '/auth/me' }
  function jwtAdapter(opts: { baseURL: string; endpoints?: Partial<AuthEndpoints>; refreshTokenStorage?: 'localStorage'|'sessionStorage'|'memory' /* mặc định 'localStorage' */; storageKey?: string /* 'mf-refresh-token' */ }): AuthAdapter
  function cookieAdapter(opts: { baseURL: string; endpoints?: Partial<AuthEndpoints> }): AuthAdapter
  function createMockAuthAdapter(opts?: { user?: AuthUser; autoLogin?: boolean }): AuthAdapter
  type AuthStatus = 'idle'|'loading'|'authenticated'|'anonymous'
  // store id 'mf-core/auth'
  const useAuthStore: StoreDefinition  // state: user, status; getters: isAuthenticated, permissions; actions: init(), login(c), logout(), refresh(), hasPermission(p)
  interface AuthApi { user: Ref<AuthUser|null>; status: Ref<AuthStatus>; isAuthenticated: ComputedRef<boolean>; login(c): Promise<AuthUser>; logout(): Promise<void>; refresh(): Promise<boolean>; hasPermission(p: string|string[]): boolean; init(): Promise<void> }
  function useAuth(): AuthApi
  function configureAuth(adapter: AuthAdapter, bus: MfBus): void   // createMfApp gọi; store dùng adapter này
  function installAuthGuard(router: Router, opts: { loginPath: string; forbiddenPath?: string /* '/403' */ }): void
  ```
  Hợp đồng HTTP của jwtAdapter: `POST login {…credentials}` → `{ accessToken, refreshToken, user }`; `POST refresh { refreshToken }` → `{ accessToken, refreshToken? }`; `POST logout { refreshToken }`; `GET me` (Bearer) → `AuthUser`. Access token chỉ giữ trong bộ nhớ.

- [ ] **Step 1: Test thất bại**
  - `jwt.test.ts`: login lưu refresh token vào localStorage key `mf-refresh-token`, `getAccessToken()` trả access token; `refresh()` không có refresh token → false không gọi mạng; refresh 401 → false và xóa token đã lưu; `refreshTokenStorage:'memory'` → localStorage không bị ghi; logout xóa cả hai.
  - **`store.test.ts` — khôi phục phiên sau reload:** localStorage có sẵn `mf-refresh-token`, adapter mới (access token rỗng) → `init()` gọi refresh rồi fetchUser → `status==='authenticated'`, `user` đúng; không có token → `status==='anonymous'`. `login` emit `auth:login`; `logout` emit `auth:logout` và `status==='anonymous'`. `hasPermission(['a','b'])` true chỉ khi có cả hai.
  - `cookie.test.ts`: request có `withCredentials: true`, `getAccessToken()` null, `init()` dựa vào `GET me` (200 → authenticated, 401 → anonymous).
  - `guard.test.ts` (router memory history): route `meta.requiresAuth` khi anonymous → redirect `/auth/login?redirect=/products`; authenticated → đi qua; `meta.permissions: ['products.write']` thiếu quyền → `/403`; guard chờ `init()` xong khi status `idle`/`loading` trước khi quyết định.
- [ ] **Step 2: Chạy** `pnpm vitest run packages/mf-core/test/auth` → FAIL.
- [ ] **Step 3: Cài đặt** các file. Adapter dùng axios trần riêng (không qua httpClient có interceptor) để tránh vòng.
- [ ] **Step 4: Chạy** → PASS.
- [ ] **Step 5: Commit** `feat(mf-core): auth store, jwt/cookie/mock adapters, route guard`.

---

### Task 5: Context + `RemoteBoundary` + trang lỗi

**Files:**
- Create: `packages/mf-core/src/app/context.ts`, `src/remotes/RemoteBoundary.vue`, `src/remotes/RemoteErrorPage.vue`
- Test: `packages/mf-core/test/boundary.test.ts`

**Interfaces:**
- Produces:
  ```ts
  const MF_CONTEXT_KEY: InjectionKey<MfContext>
  function useMfContext(): MfContext   // throw rõ ràng nếu không có provider
  // <RemoteBoundary :name="string" :timeout="number (ms, mặc định 10000)" @retry>
  //   slot mặc định; bắt lỗi con bằng onErrorCaptured → hiện khung lỗi (class mf-remote-error, text chứa name) + nút "Thử lại" (data-test="mf-retry") remount slot
  //   prop error?: Error — lỗi từ bên ngoài (loader) cũng hiện cùng khung
  // <RemoteErrorPage :name :error @retry> — toàn màn hình cho remote critical (data-test="mf-critical-error")
  ```
- [ ] **Step 1: Test thất bại** — con ném lỗi trong `setup` → boundary hiện `.mf-remote-error` chứa tên remote, lỗi không lan lên app cha; bấm `mf-retry` → remount (con hết lỗi thì hiện nội dung); `error` prop → hiện khung lỗi; `useMfContext()` ngoài provider → throw `/MfContext/`.
- [ ] **Step 2: Chạy** → FAIL. **Step 3: Cài đặt.** **Step 4: Chạy** → PASS.
- [ ] **Step 5: Commit** `feat(mf-core): RemoteBoundary, critical error page, context`.

---

### Task 6: Manifest + remote loader

**Files:**
- Create: `packages/mf-core/src/remotes/{manifest,loader}.ts`
- Test: `packages/mf-core/test/remotes/{manifest,loader}.test.ts`

**Interfaces:**
- Consumes: `RemoteEntry`, `RemoteMeta`, `RemoteSetup`, `MfContext`, `CORE_VERSION`, `RemoteBoundary`, `RemoteErrorPage`.
- Produces:
  ```ts
  type ManifestSource = string /* URL */ | RemotesManifest | (() => Promise<RemotesManifest>)
  function parseManifest(input: unknown): { remotes: RemoteEntry[]; errors: string[] }  // bỏ entry hỏng, gom lỗi
  function loadManifest(src: ManifestSource): Promise<{ remotes: RemoteEntry[]; errors: string[] }> // fetch lỗi → remotes: [], errors: [msg]
  interface FederationRuntime { register(remotes: { name: string; entry: string }[]): void; load<T>(id: string): Promise<T> }
  const mfRuntime: FederationRuntime   // bọc registerRemotes/loadRemote của @module-federation/runtime
  type LoadedRemote = RemoteEntry & { status: 'loading'|'ready'|'error'; error?: Error }
  function createRemoteLoader(deps: { runtime?: FederationRuntime; router: Router; ctxRef: () => MfContext; coreVersion?: string }): {
    remotes: Ref<LoadedRemote[]>
    loadAll(entries: RemoteEntry[]): Promise<void>   // không bao giờ reject
    ready: Promise<void>                              // resolve khi loadAll xong (thành công hay lỗi)
  }
  // Widget (chỉ host dùng): component async bọc trong RemoteBoundary, id dạng '<remote>/<expose>'
  function defineRemoteComponent(id: string, opts?: { runtime?: FederationRuntime }): Component
  ```
  Thứ tự tải mỗi remote: `register` → `load('<name>/mf-meta')` kiểm tra major với `coreVersion` → `load('<name>/routes')` (default export `RouteRecordRaw[]`) → thử `load('<name>/setup')` (không có → bỏ qua) rồi gọi với ctx. Route được gắn như con của một route cha `{ path: routePrefix, name: '<name>', component: RemoteHost }` trong đó `RemoteHost` bọc `<RouterView>` trong `<RemoteBoundary :name>`. Remote lỗi → đăng ký route `routePrefix/:pathMatch(.*)*` hiển thị `RemoteBoundary` với `error`; nếu `critical` thì hiển thị `RemoteErrorPage` toàn màn hình (bỏ layout).

- [ ] **Step 1: Test thất bại**
  - `manifest.test.ts`: JSON hợp lệ → đủ entry; **entry thiếu `entry`/`routePrefix` hoặc `name` sai định dạng → bị bỏ, `errors` có thông báo; input không phải object → `remotes: []`; `loadManifest('http://x/remotes.json')` với fetch 404 / JSON hỏng → không throw, `errors.length===1`.**
  - `loader.test.ts` (runtime giả):
    - remote OK → route `/products/` resolve được, `setup` được gọi với ctx, status `ready`.
    - **meta `coreVersion: '2.0.0'` khi host `1.3.0` → không tải routes, status `error`, message chứa `major`; truy cập `/products/x` hiện boundary lỗi.**
    - `load('products/routes')` reject → status `error`, các remote khác vẫn `ready`.
    - remote `critical` lỗi → route bắt hết `/auth/*` dùng `RemoteErrorPage`.
    - **hai remote trùng `name` hoặc trùng `routePrefix` → remote sau bị bỏ, `console.warn` gọi, remote đầu `ready`.**
    - `loadAll` không reject kể cả khi mọi remote lỗi; `ready` resolve.
    - `defineRemoteComponent('products/Widget')` render component từ runtime giả; load reject → hiện `.mf-remote-error`.
- [ ] **Step 2: Chạy** → FAIL. **Step 3: Cài đặt.** So major bằng `split('.')[0]` (dùng semver nếu cần prerelease). **Step 4: Chạy** → PASS.
- [ ] **Step 5: Commit** `feat(mf-core): runtime remote manifest and loader`.

---

### Task 7: `createMfApp` + `createStandaloneRemote`

**Files:**
- Create: `packages/mf-core/src/app/{createMfApp,createStandaloneRemote}.ts`; Modify: `src/index.ts` (xuất toàn bộ public API)
- Test: `packages/mf-core/test/app.test.ts`

**Interfaces:**
- Consumes: mọi thứ từ Task 2–6.
- Produces:
  ```ts
  interface MfAppOptions {
    root: Component                  // layout gốc, phải chứa <RouterView>
    routes?: RouteRecordRaw[]        // route của host (home, 403, 404…)
    remotes?: ManifestSource         // bỏ qua → không có remote
    auth: AuthAdapter
    api: { baseURL: string }
    loginPath?: string               // '/auth/login'
    theme?: Parameters<typeof createTheme>[0]
    i18n?: Parameters<typeof createMfI18n>[0]
    history?: RouterHistory          // mặc định createWebHistory()
    runtime?: FederationRuntime      // test inject
  }
  function createMfApp(opts: MfAppOptions): Promise<{ app: App; ctx: MfContext; mount(el: string|Element): Promise<void> }>
  function createStandaloneRemote(opts: { name: string; root?: Component; routes: RouteRecordRaw[]; routePrefix: string; setup?: RemoteSetup; auth?: AuthAdapter /* mặc định createMockAuthAdapter({autoLogin:true}) */; api: { baseURL: string } }): Promise<{ app: App; ctx: MfContext; mount(el): Promise<void> }>
  ```
  `mount`: `await auth.init()` song song với `loader.loadAll` → `await loader.ready` → `router.isReady()` → `app.mount`. Router được tạo nhưng `app.use(router)` chỉ chạy sau khi `loader.ready` để điều hướng ban đầu xảy ra khi route remote đã có. `http` = `createHttpClient({ baseURL, withCredentials: adapter.withCredentials, auth: { getAccessToken, refresh: store.refresh, onAuthFailure: () => { store.logout(); router.push(loginPath + '?redirect=' + current) } } })`. Route 404 catch-all đăng ký sau cùng.

- [ ] **Step 1: Test thất bại**
  - **deep link: memory history khởi đầu ở `/products/list`, runtime giả trả routes chậm 50ms → sau `mount` route hiện tại là `/products/list` (không phải 404), component remote đã render.**
  - manifest lỗi (`remotes: () => Promise.reject()`) → `mount` vẫn thành công, root render, `bus` nhận `notify` type `error`.
  - `ctx.http` gửi request kèm token sau `login`.
  - `createStandaloneRemote` với mock auth → route `routePrefix` render, `useAuth().isAuthenticated === true`, `setup` được gọi một lần.
  - chỉ có một Pinia: store gọi trong component remote giả và `ctx.pinia` là cùng instance.
- [ ] **Step 2: Chạy** → FAIL. **Step 3: Cài đặt.** **Step 4: Chạy** → PASS; build mf-core → PASS.
- [ ] **Step 5: Commit** `feat(mf-core): createMfApp and createStandaloneRemote`.

---

### Task 8: Playground — mocks + shell + auth-service + products-service

**Files:**
- Create: `playground/mocks/{package.json,src/handlers.ts,src/index.ts}` (`startMocks()` chạy MSW worker; `public/mockServiceWorker.js` sinh bằng `msw init` ở shell và products-service)
- Create: `playground/shell/{package.json,vite.config.ts,index.html,public/remotes.json,src/main.ts,src/bootstrap.ts,src/Layout.vue,src/pages/{Home,Forbidden,NotFound}.vue}`
- Create: `playground/auth-service/{package.json,vite.config.ts,index.html,src/main.ts,src/bootstrap.ts,src/routes.ts,src/setup.ts,src/pages/Login.vue}`
- Create: `playground/products-service/{package.json,vite.config.ts,index.html,src/main.ts,src/bootstrap.ts,src/routes.ts,src/stores/list.ts,src/pages/ProductList.vue,src/products.css}`

**Interfaces:**
- Consumes: `defineHost`, `defineRemote` (Task 1); `createMfApp`, `createStandaloneRemote`, `jwtAdapter`, `useAuth`, `useMfContext`, `registerMessages` (Task 2–7).
- Produces (mock API, baseURL `/api`):
  - `POST /api/auth/login {username,password}` — `admin`/`admin` → `{accessToken:'at-<n>', refreshToken:'rt-<n>', user:{id:'1',name:'Admin',permissions:['products.read']}}`; sai → 401.
  - `POST /api/auth/refresh {refreshToken}` → token mới hoặc 401; `POST /api/auth/logout` → 204; `GET /api/auth/me` (Bearer hợp lệ) → user.
  - `GET /api/products` (Bearer hợp lệ) → `[{id:1,name:'Bàn phím',price:500000},…3 item]`; không/sai token → 401.
  - `remotes.json`: `auth` (5001, `/auth`, `critical: true`, không menu) và `products` (5002, `/products`, menu `Sản phẩm`), `entry` = `http://localhost:<port>/mf-manifest.json` (hoặc `remoteEntry.js` nếu manifest không dùng được với runtime).
  - Ports: shell 5000, auth 5001, products 5002. Script `dev` (vite) và `preview` (build + vite preview) cho mỗi app.

- [ ] **Step 1:** Tạo `mocks` + `shell`. `main.ts` = `import('./bootstrap')`; `bootstrap.ts` chạy `startMocks()` rồi `createMfApp({ root: Layout, routes, remotes: '/remotes.json', auth: jwtAdapter({ baseURL: '/api' }), api: { baseURL: '/api' } })`. Layout: header (tên user + nút Đăng xuất khi đăng nhập), menu từ `ctx.remotes` có `menu`, `<RouterView>`; nút đổi theme sáng/tối. Route `/products` của host không có — chỉ đến từ remote.
- [ ] **Step 2:** Tạo `auth-service`: expose `./routes` (`[{ path: 'login', component: Login }]`) và `./setup` (đăng ký i18n `auth`). `Login.vue`: form username/password (`data-test="username"`, `"password"`, `"submit"`), gọi `useAuth().login()`, thành công → `router.replace(route.query.redirect ?? '/')`, sai → hiện lỗi (`data-test="login-error"`). Standalone bootstrap dùng `createStandaloneRemote`.
- [ ] **Step 3:** Tạo `products-service`: route `''` với `meta.requiresAuth: true` → `ProductList.vue` dùng store `products/list` (`defineStore('products/list')`, action `fetch()` gọi `useMfContext().http.get('/products')`); hiển thị bảng `data-test="product-row"`; `products.css` đặt `.products-title { color: var(--mf-color-primary) }`. Standalone bootstrap chạy `startMocks()` + `createStandaloneRemote` với `jwtAdapter` hoặc mock auth (mock adapter trả token `at-standalone` mà handler chấp nhận).
- [ ] **Step 4: Kiểm tra thủ công** — `pnpm dev` → mở `http://localhost:5000`: vào `/products` bị chuyển tới `/auth/login?redirect=/products`; đăng nhập `admin/admin` → thấy 3 dòng sản phẩm; tiêu đề có màu primary (CSS remote được nạp); DevTools chỉ có 1 bản Vue (Vue DevTools hiện 1 app). Nếu dev mode của `@module-federation/vite` có vấn đề, ghi lại và kiểm tra bằng `pnpm -r preview`.
- [ ] **Step 5:** `pnpm --filter products-service dev` riêng → `http://localhost:5002/products` hiện danh sách khi không có shell.
- [ ] **Step 6: Commit** `feat(playground): shell, auth-service, products-service with mock API`.

---

### Task 9: E2E luồng chính (Playwright)

**Files:**
- Create: `playground/e2e/{package.json,playwright.config.ts,tests/flow.spec.ts}`

**Interfaces:**
- Consumes: playground Task 8 chạy ở chế độ `preview` (build thật). `playwright.config.ts` dùng `webServer` khởi động 3 app ở 5000/5001/5002.

- [ ] **Step 1: Viết test** `flow.spec.ts`:
  - `chưa đăng nhập vào /products → về /auth/login?redirect=%2Fproducts`
  - `đăng nhập admin/admin → về /products, thấy 3 product-row`
  - `sai mật khẩu → login-error hiển thị`
  - `reload /products sau khi đăng nhập → vẫn thấy danh sách (phiên khôi phục)`
  - `CSS remote: getComputedStyle(.products-title).color khác màu mặc định`
  - `chặn request tới localhost:5002 (page.route abort) → /products hiện .mf-remote-error, header shell và /auth/login vẫn hoạt động`
  - `chặn localhost:5001 → hiện mf-critical-error`
  - `chỉ một bản Vue: page.evaluate đếm số app Vue (window.__VUE__ / devtools hook) bằng 1` — nếu không đo được tin cậy, thay bằng kiểm tra store `mf-core/auth` thấy cùng user từ cả header (host) và trang products (remote).
- [ ] **Step 2: Chạy** `pnpm e2e` → các test chạy; sửa playground/core cho tới khi PASS hết.
- [ ] **Step 3: Commit** `test(e2e): main auth + isolation flow`.

---

### Task 10: CLI `create-mf`

**Files:**
- Create: `packages/create-mf/{package.json,tsup.config.ts}`, `src/{index,generate}.ts`, `templates/host/**`, `templates/remote/**`
- Test: `packages/create-mf/test/generate.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface GenerateOptions { kind: 'host'|'remote'; name: string; targetDir: string; port?: number; frameworkVersion: string /* đọc từ package.json của create-mf */ }
  function generate(opts: GenerateOptions): Promise<void>
  ```
  Template là bản rút gọn của playground (host = shell không có mocks; remote = products-service với một trang mẫu). Placeholder `{{name}}`, `{{port}}`, `{{frameworkVersion}}`; file `_gitignore`/`_npmrc` đổi tên khi sinh. `bin: { "create-mf": "dist/index.js" }` → chạy được `pnpm create @nineh-fe-base/mf <name>`.

- [ ] **Step 1: Test thất bại**
  - remote `name: 'orders'` → có `vite.config.ts` chứa `defineRemote({ name: 'orders'`, `package.json` có `"@nineh-fe-base/mf-core": "^<frameworkVersion>"` và `@nineh-fe-base/mf-vite` trong devDependencies, `.npmrc` chứa `@nineh-fe-base:registry=https://npm.pkg.github.com`, `src/main.ts` là `import('./bootstrap')`.
  - host → có `public/remotes.json` với `remotes: []`.
  - `targetDir` đã tồn tại và không rỗng → throw `/not empty/`.
  - `name` không hợp lệ cho remote (`my-orders`) → throw (cùng quy tắc với mf-vite).
- [ ] **Step 2: Chạy** → FAIL. **Step 3: Cài đặt** `generate.ts` và `index.ts` (@clack/prompts hỏi kind, name, port; tham số dòng lệnh `--kind`, `--port` bỏ qua prompt). **Step 4: Chạy** → PASS.
- [ ] **Step 5: Kiểm tra thủ công** — sinh một remote vào thư mục tạm ngoài repo, đổi dependency thành `link:` tới `packages/*`, `pnpm install && pnpm dev` → trang mẫu chạy standalone.
- [ ] **Step 6: Commit** `feat(create-mf): scaffold host/remote projects`.

---

### Task 11: Chuẩn bị phát hành, CI, tài liệu

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `README.md`, `packages/*/README.md`, `.changeset/initial-release.md`
- Modify: `packages/*/package.json` (kiểm `publishConfig`, `files: ["dist", "templates"]`, `repository`)

- [ ] **Step 1:** `ci.yml` — trên push/PR: pnpm install, lint, test, build, cài Playwright + `pnpm e2e`.
- [ ] **Step 2:** `release.yml` — trên push `main`: `changesets/action` publish với `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`, `permissions: packages: write, contents: write`; registry `https://npm.pkg.github.com`, scope `@nineh-fe-base`. Ghi chú trong README: workflow chỉ chạy được khi repo thuộc owner `nineh-fe-base`.
- [ ] **Step 3:** README gốc (tiếng Việt): kiến trúc, cách chạy playground, hợp đồng remote (`./routes`, `./setup`, `./mf-meta` tự sinh, `remotes.json` + `critical`), cách viết AuthAdapter riêng, quy ước store id, cách cài từ GitHub Packages (`.npmrc` + token `read:packages`), chính sách version (tương thích ngược trong một major).
- [ ] **Step 4: Kiểm tra** — `pnpm lint && pnpm test && pnpm build && pnpm e2e` → tất cả PASS; `pnpm --filter "./packages/*" exec npm pack --dry-run` → mỗi tarball chỉ chứa `dist` (+ `templates` cho create-mf), không có `src`/`test`.
- [ ] **Step 5: Commit** `chore: release workflow, CI, docs`.
