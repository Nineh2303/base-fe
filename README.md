# nineh-fe-base: framework micro-frontend Vue 3 + Vite

Monorepo (npm workspaces) gồm framework micro-frontend dựa trên Module Federation (`@module-federation/vite`), scope `@nineh-fe-base`.

| Package | Vai trò |
| --- | --- |
| `@nineh-fe-base/mf-vite` | `defineHost` / `defineRemote`: cấu hình Vite + federation, shared singleton, sinh `./mf-meta` |
| `@nineh-fe-base/mf-core` | Runtime: `createMfApp`, remote loader, auth, http client, bus, theme, i18n |
| `@nineh-fe-base/ui` | Component Vue kiểu shadcn-vue (Reka UI + Tailwind v4), dùng chung host/remote, theo token `--mf-*` |
| `@nineh-fe-base/create-mf` | CLI sinh project host/remote, và `ui add` để eject component |
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

Tương thích ngược trong một major của `mf-core`. Khi còn `0.x`, tăng minor là breaking: host 0.1.x **từ chối** nạp remote build với 0.2.x (và ngược lại), hiện lỗi rõ ràng. Lệch major cũng bị từ chối. Bốn package framework dùng chung version (`fixed` trong changesets).

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
- Khi chạy CLI từ chính repo này (trước khi publish), phải build trước: `npm run build -w @nineh-fe-base/create-mf` (`bin` trỏ tới `dist/index.js`).
- Project sinh ra đã có sẵn Tailwind và `@nineh-fe-base/ui` (xem mục Tailwind & UI).

## Tailwind & UI

Mọi app dùng Tailwind v4 (plugin `@tailwindcss/vite` do `defineHost`/`defineRemote` tự thêm) và bộ component `@nineh-fe-base/ui`. Màu sắc, bo góc, font của component đọc từ token `--mf-*` của `mf-core/theme`, nên `theme.setMode('dark')` đổi giao diện của host và mọi remote cùng lúc.

### File CSS và nơi import

- **Host**: import `@nineh-fe-base/ui/styles/host.css` một lần (trong `src/bootstrap.ts`). Gồm Tailwind đầy đủ (có preflight), ánh xạ token, biến thể `dark`, và `@source` tới `dist` của ui.
- **Remote**: tạo `src/style.css` chứa `@import '@nineh-fe-base/ui/styles/remote.css';` rồi `import './style.css'` từ module được expose (`routes.ts`), để khi host nạp remote thì CSS của remote nạp theo. `remote.css` giống `host.css` nhưng **không có preflight**.
- **Chạy standalone**: `bootstrap.ts` của remote import thêm `host.css` để có preflight.

```css
/* src/style.css của remote */
@import '@nineh-fe-base/ui/styles/remote.css';
```

Thứ tự layer cố định, cả hai file đều khai báo `@layer theme, base, components, utilities;` nên thứ tự nạp stylesheet không quan trọng. Dark mode: `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`, khớp thuộc tính `data-theme` mà theme đã đặt.

**Lưu ý**: CSS tự viết **không nằm trong layer** luôn thắng utility của Tailwind (vì layer luôn thua CSS không layer). Nếu muốn utility ghi đè được, bọc CSS của bạn trong `@layer components { ... }`.

### 4 lớp tuỳ biến theo từng service

1. **Token theo scope.** Mỗi remote được bọc trong `<div data-mf-remote="<tên>" style="display:contents">`. Override token chỉ trong vùng của service, viết **không layer**:

   ```css
   [data-mf-remote='orders'] {
     --mf-color-primary: #16a34a;
     --mf-color-primary-foreground: #ffffff;
   }
   [data-theme='dark'] [data-mf-remote='orders'] { --mf-color-primary: #4ade80; }
   ```

   Template remote có sẵn ví dụ này (đang comment) trong `src/style.css`; `playground/products-service` dùng primary màu xanh lá.
2. **Class/props tại chỗ gọi.** `tailwind-merge` cho class của bạn thắng: `<Button class="rounded-full">Lưu</Button>`.
3. **Mở rộng variant.** Package export mọi định nghĩa `cva` (`buttonVariants`, `badgeVariants`, ...) cùng `cn`:

   ```ts
   import { buttonVariants, cn } from '@nineh-fe-base/ui'

   export const brandButton = (class_?: string) =>
     cn(buttonVariants({ variant: 'default' }), 'bg-gradient-to-r from-primary to-accent', class_)
   ```
4. **Eject.** Sao chép source component vào project, từ đó service tự sở hữu bản đó:

   ```bash
   npx @nineh-fe-base/create-mf ui add button dialog            # -> src/components/ui/<tên>/
   npx @nineh-fe-base/create-mf ui add card --dir src/ui --force # đổi thư mục, cho phép ghi đè
   ```

   Không có `--force` thì lệnh từ chối ghi đè file đã có; tên không tồn tại thì in danh sách component. Import nội bộ (`lib/utils`, helper) được viết lại thành `@nineh-fe-base/ui`; import tới component anh em được viết lại tương tự, trừ khi component đó cũng được eject cùng lệnh hoặc đã có trong thư mục đích.

### Overlay và portal

Dialog, DropdownMenu, Select, Tooltip dùng portal của Reka UI. `RemoteBoundary` (host) và `createStandaloneRemote` đặt `<div data-mf-portal>` làm con cuối của scope element và cung cấp nó qua `MF_PORTAL_KEY`; component của ui lấy đích qua `usePortalTo()` (rơi về `body` nếu không có). Nhờ đó overlay "teleport" vào **scope của service** và giữ nguyên token override. Component tự viết có thể dùng `useMfPortalTarget()` từ `mf-core`.

### Toast

Chỉ mount **một** `<Toaster />` cho cả app (trong Layout của host); vue-sonner dùng một store toàn cục nên mọi `Toaster` đều hiện mọi `toast()`. Gọi `toast(...)` (export từ `@nineh-fe-base/ui`) ở bất kỳ đâu.

### Tắt Tailwind

`defineHost({ ..., tailwind: false })` / `defineRemote({ ..., tailwind: false })` không thêm plugin Tailwind. Khi `package.json` của project có `@nineh-fe-base/ui`, `mf-vite` tự chia sẻ `@nineh-fe-base/ui` và `reka-ui` như singleton (không cần cấu hình `shared`).

## Cài từ GitHub Packages

Package publish lên GitHub Packages (`https://npm.pkg.github.com`). Để cài, thêm vào `.npmrc` (project hoặc user):

```ini
@nineh-fe-base:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

với `NPM_TOKEN` là personal access token (classic) có quyền `read:packages`. Project sinh bởi `create-mf` đã có sẵn dòng registry; bạn vẫn cần cấu hình token.

## Phát hành

- Ghi thay đổi bằng `npm run changeset`; `.changeset/initial-release.md` là bản phát hành đầu (minor cho cả ba package đầu tiên); `.changeset/ui-tailwind.md` thêm Tailwind/ui (minor cho bốn package).
- `.github/workflows/ci.yml`: mọi push/PR chạy lint, test, build, e2e (Node 22).
- `.github/workflows/release.yml`: push `main` chạy `changesets/action` (tạo PR "Version Packages", sau đó `changeset publish`) lên GitHub Packages với `GITHUB_TOKEN`.
- Lưu ý: workflow release chỉ publish được khi repo thuộc owner `nineh-fe-base` (scope package phải trùng owner). Trường `repository` trong `package.json` các package dùng tên repo tạm `mf-framework`; cần sửa theo tên repo thật.
- Chưa publish thật.
