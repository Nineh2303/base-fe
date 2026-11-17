# base-fe: framework micro-frontend Vue 3 + Vite

Monorepo (npm workspaces) gồm framework micro-frontend dựa trên Module Federation (`@module-federation/vite`), scope `@nineh2303`.

| Package | Vai trò |
| --- | --- |
| `@nineh2303/mf-vite` | `defineHost` / `defineRemote`: cấu hình Vite + federation, shared singleton, sinh `./mf-meta` |
| `@nineh2303/mf-core` | Runtime: `createMfApp`, remote loader, auth, http client, bus, theme, i18n |
| `@nineh2303/ui` | Component Vue kiểu shadcn-vue (Reka UI + Tailwind v4), dùng chung host/remote, theo token `--mf-*` |
| `@nineh2303/create-mf` | CLI sinh project host/remote, và `ui add` để eject component |
| `playground/*` | Ví dụ chạy được: `shell` (host, :5000), `auth-service` (remote, :5001), `products-service` (remote, :5002), `mocks` (MSW), `e2e` (Playwright) |

## Kiến trúc

- **Host** (shell): ứng dụng chính, gọi `createMfApp(...)`. Tạo app Vue, pinia, router, i18n, bus, theme, http client, rồi đọc `remotes.json` và nạp các remote lúc chạy.
- **Remote**: micro-frontend độc lập (có thể chạy standalone qua `createStandaloneRemote`), expose route và (tuỳ chọn) hàm setup.
- **mf-core singleton**: `vue`, `pinia`, `vue-router`, `vue-i18n` và `@nineh2303/mf-core` luôn là shared singleton; không bao giờ có hai bản chạy cùng lúc. Nhờ vậy store auth (`mf-core/auth`), bus, theme dùng chung giữa host và mọi remote. Remote vẫn bundle bản fallback để chạy standalone.
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

Tương thích ngược trong một major của `mf-core`. Khi còn `0.x`, tăng minor là breaking: host 0.1.x **từ chối** nạp remote build với 0.2.x (và ngược lại), hiện lỗi rõ ràng. Lệch major cũng bị từ chối. Các package framework dùng chung version (`fixed` trong changesets).

Loader chỉ kiểm tra tương thích của `mf-core`, **không** kiểm tra `@nineh2303/ui`. ui được giữ đồng bộ nhờ nhóm `fixed` của Changesets (cùng version với `mf-core`) và template dùng `^frameworkVersion` cho mọi package framework. Hãy giữ host và mọi remote trên **cùng minor** của framework, để ui (singleton) không bị lệch giữa host và remote.

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
npm create @nineh2303/mf <name> -- --kind host|remote --port N
cd <name> && npm install && npm run dev
```

- `<name>` phải là JS identifier (không có dấu `-`); với host còn phải là tên npm hợp lệ (chữ thường). Tên package npm suy ra dạng kebab-case (`myOrders` -> `my-orders`).
- `--port` mặc định 5000 (host) / 5010 (remote). Không truyền đủ tham số thì CLI hỏi tương tác (cần TTY).
- Khi chạy CLI từ chính repo này (trước khi publish), phải build trước: `npm run build -w @nineh2303/create-mf` (`bin` trỏ tới `dist/index.js`).
- Project sinh ra đã có sẵn Tailwind và `@nineh2303/ui` (xem mục Tailwind & UI).

## Tailwind & UI

Mọi app dùng Tailwind v4 (plugin `@tailwindcss/vite` do `defineHost`/`defineRemote` tự thêm) và bộ component `@nineh2303/ui`. Màu sắc, bo góc, font của component đọc từ token `--mf-*` của `mf-core/theme`, nên `theme.setMode('dark')` đổi giao diện của host và mọi remote cùng lúc.

### File CSS và nơi import

- **Host**: import `@nineh2303/ui/styles/host.css` một lần (trong `src/bootstrap.ts`). Gồm Tailwind đầy đủ (có preflight), ánh xạ token, biến thể `dark`, và `@source` tới `dist` của ui.
- **Remote**: tạo `src/style.css` chứa `@import '@nineh2303/ui/styles/remote.css';` rồi `import './style.css'` từ module được expose (`routes.ts`), để khi host nạp remote thì CSS của remote nạp theo. `remote.css` giống `host.css` nhưng **không có preflight**.
- **Chạy standalone**: `bootstrap.ts` của remote import thêm `host.css` để có preflight.

```css
/* src/style.css của remote */
@import '@nineh2303/ui/styles/remote.css';
```

Thứ tự layer cố định: cả hai file đều khai báo `@layer theme, base, components, utilities;`, nên preflight luôn nằm dưới utility dù stylesheet nào nạp trước. Trong **cùng** một layer, hai rule cùng specificity vẫn phân thắng thua theo thứ tự nạp: stylesheet của remote nạp sau có `.hidden{display:none}` nhưng không có `md:flex` của host, nên sẽ làm ẩn phần tử `hidden md:flex` của host.

Vì vậy `defineRemote` (khi bật Tailwind) bọc CSS của remote trong `@scope ([data-mf-remote="<tên>"]) to ([data-mf-remote])`. Rule của remote chỉ áp vào vùng của nó (không lan vào remote lồng bên trong), và trong vùng đó nó thắng rule cùng specificity của host. Remote **không thể** style ra ngoài vùng của mình; đó là thiết kế. Những phần vẫn toàn cục: layer `theme` (biến `:root`), `@property`, `@keyframes`, `@font-face`, câu lệnh `@layer`, `@import`, và rule nhắm chính scope element (`[data-mf-remote='x']`, `[data-theme='dark'] [data-mf-remote='x']`) để override token vẫn chạy. `host.css` mà `bootstrap.ts` standalone import thì không bị bọc. Trình duyệt hỗ trợ `@scope`: Chrome/Edge 118+, Safari 17.4+, Firefox 146+.

Dark mode: `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`, khớp thuộc tính `data-theme` mà theme đã đặt.

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
   import { buttonVariants, cn } from '@nineh2303/ui'

   export const brandButton = (class_?: string) =>
     cn(buttonVariants({ variant: 'default' }), 'bg-gradient-to-r from-primary to-accent', class_)
   ```
4. **Eject.** Sao chép source component vào project, từ đó service tự sở hữu bản đó:

   ```bash
   npx @nineh2303/create-mf ui add button dialog            # -> src/components/ui/<tên>/
   npx @nineh2303/create-mf ui add card --dir src/ui --force # đổi thư mục, cho phép ghi đè
   ```

   Không có `--force` thì lệnh từ chối ghi đè file đã có; tên không tồn tại thì in danh sách component. Import nội bộ (`lib/utils`, helper) được viết lại thành `@nineh2303/ui`; import tới component anh em được viết lại tương tự, trừ khi component đó cũng được eject cùng lệnh hoặc đã có trong thư mục đích. File đã eject import thẳng `reka-ui`, `lucide-vue-next`, `class-variance-authority`, ...; lệnh cảnh báo package nào chưa có trong `package.json` của project và in sẵn lệnh `npm install` (version lấy theo ui).

   **Không eject Toaster** trừ khi project tự gọi `toast` từ vue-sonner của chính nó: `Toaster` đã eject đóng gói store vue-sonner riêng, nên `toast()` từ `@nineh2303/ui` dùng chung không hiện trong nó.

### Overlay và portal

Dialog, DropdownMenu, Select, Tooltip dùng portal của Reka UI. `RemoteBoundary` (host) và `createStandaloneRemote` đặt `<div data-mf-portal>` làm con cuối của scope element và cung cấp nó qua `MF_PORTAL_KEY`; component của ui lấy đích qua `usePortalTo()` (rơi về `body` nếu không có). Nhờ đó overlay "teleport" vào **scope của service** và giữ nguyên token override. Component tự viết có thể dùng `useMfPortalTarget()` từ `mf-core`.

### Toast

Chỉ mount **một** `<Toaster />` cho cả app (trong Layout của host); vue-sonner dùng một store toàn cục nên mọi `Toaster` đều hiện mọi `toast()`. Gọi `toast(...)` (export từ `@nineh2303/ui`) ở bất kỳ đâu.

Toaster duy nhất nằm ở scope của host, nên toast luôn dùng token của host, kể cả khi `toast()` được gọi từ một remote có override token theo scope. Đây là sai khác đã được chấp nhận so với spec §4.

### Tắt Tailwind

`defineHost({ ..., tailwind: false })` / `defineRemote({ ..., tailwind: false })` không thêm plugin Tailwind. Khi `package.json` của project có `@nineh2303/ui`, `mf-vite` tự chia sẻ `@nineh2303/ui` và `reka-ui` như singleton (không cần cấu hình `shared`).

## Cài từ GitHub Packages

Package publish lên GitHub Packages (`https://npm.pkg.github.com`). Để cài, thêm vào `.npmrc` (project hoặc user):

```ini
@nineh2303:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

với `NPM_TOKEN` là personal access token (classic) có quyền `read:packages`. Project sinh bởi `create-mf` đã có sẵn dòng registry; bạn vẫn cần cấu hình token.

## Phát hành

- Ghi thay đổi bằng `npm run changeset`; `.changeset/initial-release.md` là bản phát hành đầu (minor cho cả ba package đầu tiên); `.changeset/ui-tailwind.md` thêm Tailwind/ui (minor cho bốn package).
- `.github/workflows/ci.yml`: mọi push/PR chạy lint, test, build, e2e (Node 22).
- `.github/workflows/release.yml`: push `main` chạy `changesets/action` (tạo PR "Version Packages", sau đó `changeset publish`) lên GitHub Packages với `GITHUB_TOKEN`.
- Lưu ý: GitHub Packages yêu cầu scope package trùng owner repo: scope `@nineh2303` ứng với repo `github.com/Nineh2303/base-fe`. Đổi owner/repo thì phải đổi scope và trường `repository` theo.
- Chưa publish thật.
