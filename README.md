# nineh-fe-base: framework micro-frontend Vue 3 + Vite

Monorepo (npm workspaces) gồm framework micro-frontend dựa trên Module Federation (`@module-federation/vite`), scope `@nineh-fe-base`.

| Package | Vai trò |
| --- | --- |
| `@nineh-fe-base/mf-vite` | `defineHost` / `defineRemote`: cấu hình Vite + federation, shared singleton, sinh `./mf-meta` |
| `@nineh-fe-base/mf-core` | Runtime: `createMfApp`, remote loader, auth, http client, bus, theme, i18n |
| `@nineh-fe-base/create-mf` | CLI sinh project host/remote |
| `playground/*` | Ví dụ chạy được: `shell` (host, :5000), `auth-service` (remote, :5001), `products-service` (remote, :5002), `mocks` (MSW), `e2e` (Playwright) |

## Kiến trúc

- **Host** (shell): ứng dụng chính, gọi `createMfApp(...)`. Tạo app Vue, pinia, router, i18n, bus, theme, http client, rồi đọc `remotes.json` và nạp các remote lúc chạy.
- **Remote**: micro-frontend độc lập (có thể chạy standalone qua `createStandaloneRemote`), expose route và (tuỳ chọn) hàm setup.
- **mf-core singleton**: `vue`, `pinia`, `vue-router`, `vue-i18n` và `@nineh-fe-base/mf-core` luôn là shared singleton; không bao giờ có hai bản chạy cùng lúc. Nhờ vậy store auth (`mf-core/auth`), bus, theme dùng chung giữa host và mọi remote. Remote vẫn bundle bản fallback để chạy standalone.
- **Đăng ký remote lúc chạy**: host không import remote tĩnh. Nó đọc `remotes.json` (URL hoặc object) và đăng ký từng remote bằng `@module-federation/runtime`, nên thêm remote không cần build lại host.

### Hợp đồng remote

Remote (qua `defineRemote({ name, port, exposes })`) phải/có thể expose:

- `./routes` (bắt buộc): mảng `RouteRecordRaw`; path ở cấp đầu là tương đối so với `routePrefix`.
- `./setup` (tuỳ chọn): `(ctx: MfContext) => void | Promise<void>` (`RemoteSetup`), dùng để đăng ký i18n, lắng nghe bus...; `ctx` gồm `app, pinia, router, i18n, bus, auth, http, remotes`.
- `./mf-meta`: **tự sinh** bởi `defineRemote` (`{ name, coreVersion }`), không tự viết.

Quy ước đặt tên:

- Tên route của remote được tự động thêm tiền tố `<remote>/`. Route khai báo `name: 'list'` trong remote `products` được điều hướng bằng `{ name: 'products/list' }`.
- Store id của remote phải có tiền tố `<remote>/<store>` (ví dụ `products/list`). Store của core là `mf-core/auth`.
- Tên remote (`name`) phải là JS identifier.

Route meta được guard hiểu: `requiresAuth: true`, `permissions: ['products.read']`.

### `remotes.json`

```json
{
  "remotes": [
    { "name": "auth", "entry": "http://localhost:5001/mf-manifest.json", "routePrefix": "/auth", "critical": true },
    { "name": "products", "entry": "http://localhost:5002/mf-manifest.json", "routePrefix": "/products",
      "menu": { "label": "Sản phẩm", "order": 1 } }
  ]
}
```

| Trường | Ý nghĩa |
| --- | --- |
| `name` | Tên remote (trùng `name` trong `defineRemote`) |
| `entry` | URL `mf-manifest.json` của remote |
| `routePrefix` | Tiền tố URL của remote trong host |
| `critical` | (tuỳ chọn) Remote lỗi thì hiện trang lỗi toàn màn hình (không layout); remote không critical lỗi chỉ hiện khung lỗi trong layout |
| `menu` | (tuỳ chọn) `{ label, order? }`: để host dựng menu từ `useMfContext().remotes` |

Name hoặc `routePrefix` trùng thì remote đến sau bị bỏ qua (có cảnh báo). Mỗi remote có timeout nạp mặc định 10 giây.

### Chính sách version

Tương thích ngược trong một major của `mf-core`. Khi còn `0.x`, tăng minor là breaking: host 0.1.x **từ chối** nạp remote build với 0.2.x (và ngược lại), hiện lỗi rõ ràng. Lệch major cũng bị từ chối. Ba package framework dùng chung version (`fixed` trong changesets).

### Auth

`createMfApp({ auth: ... })` nhận một `AuthAdapter`:

- `jwtAdapter({ baseURL, endpoints?, refreshTokenStorage?, storageKey? })`: access token chỉ giữ trong bộ nhớ (không bao giờ lưu storage); refresh token lưu theo `refreshTokenStorage`: `'localStorage'` (mặc định), `'sessionStorage'` hoặc `'memory'`.
- `cookieAdapter({ baseURL, endpoints? })`: session bằng cookie (`withCredentials`), `getAccessToken()` luôn `null`.
- `createMockAuthAdapter()`: cho dev/standalone.
- Endpoint mặc định: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`.
- Adapter riêng: implement interface `AuthAdapter`:

```ts
interface AuthAdapter {
  login(credentials: Record<string, unknown>): Promise<AuthUser>
  logout(): Promise<void>
  refresh(): Promise<boolean>
  fetchUser(): Promise<AuthUser | null> // khôi phục phiên khi khởi động
  getAccessToken(): string | null       // cookie adapter trả null
  withCredentials?: boolean             // cookie adapter = true
}
// AuthUser = { id: string; name: string; permissions: string[]; [k: string]: unknown }
```

Quyền: `hasPermission('a')` / `hasPermission(['a','b'])` yêu cầu có đủ; quyền `'*'` là wildcard toàn cục (đủ mọi quyền). Guard chuyển về `loginPath` (mặc định `/auth/login`, kèm `?redirect=`) nếu route cần đăng nhập, về `/403` nếu thiếu quyền. Khi API trả 401, http client tự refresh một lần rồi đăng xuất nếu thất bại.

## Chạy playground

Yêu cầu Node >= 20, cổng 5000-5002 trống.

```bash
npm install
npm run dev       # shell :5000, auth-service :5001, products-service :5002 (dev server)
npm run preview   # chạy bản build (tự build framework trước)
npm test          # vitest
npm run e2e       # Playwright (tự build + preview 3 app; lần đầu: npx playwright install chromium)
```

Mở http://localhost:5000, đăng nhập `admin` / `admin`. API là mock bằng MSW (`playground/mocks`).

## Tạo project mới

```bash
npm create @nineh-fe-base/mf <name> -- --kind host|remote --port N
cd <name> && npm install && npm run dev
```

- `<name>` phải là JS identifier (không có dấu `-`); với host còn phải là tên npm hợp lệ (chữ thường). Tên package npm suy ra dạng kebab-case (`myOrders` -> `my-orders`).
- `--port` mặc định 5000 (host) / 5010 (remote). Không truyền đủ tham số thì CLI hỏi tương tác (cần TTY).

## Cài từ GitHub Packages

Package publish lên GitHub Packages (`https://npm.pkg.github.com`). Để cài, thêm vào `.npmrc` (project hoặc user):

```ini
@nineh-fe-base:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

với `NPM_TOKEN` là personal access token (classic) có quyền `read:packages`. Project sinh bởi `create-mf` đã có sẵn dòng registry; bạn vẫn cần cấu hình token.

## Phát hành

- Ghi thay đổi bằng `npm run changeset`; `.changeset/initial-release.md` là bản phát hành đầu (minor cho cả ba package).
- `.github/workflows/ci.yml`: mọi push/PR chạy lint, test, build, e2e (Node 22).
- `.github/workflows/release.yml`: push `main` chạy `changesets/action` (tạo PR "Version Packages", sau đó `changeset publish`) lên GitHub Packages với `GITHUB_TOKEN`.
- Lưu ý: workflow release chỉ publish được khi repo thuộc owner `nineh-fe-base` (scope package phải trùng owner). Trường `repository` trong `package.json` các package dùng tên repo tạm `mf-framework`; cần sửa theo tên repo thật.
- Chưa publish thật.
