# Thiết kế: Framework micro-frontend Vue 3 + Vite + Module Federation

Ngày: 2026-11-16 · Trạng thái: bản nháp chờ duyệt

## 1. Mục đích và lý do

Xây một **bộ khung dạng framework** (đóng gói thành package npm, publish lên GitHub Packages) để mọi dự án micro-frontend sau này dùng lại, thay vì mỗi lần dựng lại từ đầu. Hiện tại là khung khởi đầu; về sau sẽ dùng cho sản phẩm phức tạp hơn, nên nền móng phải chắc, nâng cấp được tập trung (bump version), và không bó tay dự án dùng nó.

Người dùng framework là developer (chủ yếu là chính tác giả) code Vue thuận tay.

## 2. Mục tiêu / Không làm / Thất bại nếu

**Mục tiêu**
- Dự án mới tạo host hoặc remote bằng 1 lệnh CLI, cấu hình federation chỉ vài dòng (`defineHost()` / `defineRemote()`).
- Core cài sẵn và chia sẻ (singleton) `vue`, `pinia`, `vue-router` và chính runtime của framework; remote "kéo về dùng", không tự cài bản riêng.
- **Dữ liệu nghiệp vụ độc lập trên từng service**: mỗi remote tự định nghĩa store Pinia của mình, không đọc store của remote khác.
- **Auth dùng chung qua core**: `useAuth()` + `httpClient` tự gắn token / refresh; `auth-service` chỉ lo màn hình; `products-service` gọi API có xác thực mà không phụ thuộc trực tiếp vào `auth-service`.
- Đăng ký remote **lúc chạy** từ `remotes.json` → deploy lại / thêm remote không cần build lại host.
- Remote lỗi tải hoặc crash → chỉ vùng đó hiện lỗi, shell vẫn chạy.
- Mỗi remote chạy độc lập được (standalone dev) mà không cần host.

**Không làm (ở phiên bản này)**
- Không gắn thư viện UI vào core (chỉ có theme tokens/CSS variables). Package UI tùy chọn để sau.
- Không SSR / Nuxt.
- Không hỗ trợ remote viết bằng framework khác (React…).
- Không có backend thật; API trong playground là mock.
- Không làm hạ tầng deploy (chỉ build ra static + ví dụ cấu hình).

**Coi là thất bại dù vẫn chạy được, nếu**
- Có 2 bản Vue/Pinia chạy cùng lúc (store tách đôi, `inject` không thấy nhau).
- Dự án dùng framework phải hiểu/viết tay cấu hình Module Federation mới chạy được.
- Một remote sập kéo sập cả shell.
- Framework không có chỗ mở rộng, khiến dự án phải fork để đổi cách auth hay endpoint.

## 3. Ràng buộc

- Vue 3 + TypeScript, Vite, Pinia, Vue Router (bản stable hiện hành).
- Federation: `@module-federation/vite` (Module Federation 2.0, có runtime API và manifest). Không dùng `@originjs/vite-plugin-federation`.
- Monorepo pnpm workspaces.
- Publish lên **GitHub Packages** (`npm.pkg.github.com`). Lưu ý: scope npm bắt buộc trùng tên user/org GitHub sở hữu repo; người dùng package cần `.npmrc` + token có quyền `read:packages` (kể cả khi package public).

## 4. Các hướng đã cân nhắc

**Chia sẻ auth**
- **A (đã chọn) — Auth nằm ở core**: store + `useAuth()` + `httpClient` trong `mf-core`, được share singleton. Một nguồn sự thật, có type, các remote không phụ thuộc chéo.
- B — `auth-service` expose store qua federation: remote phụ thuộc remote, auth sập là vỡ dây chuyền. Loại.
- C — chỉ qua event bus: lặp code, dễ lệch trạng thái, mất reactive. Loại.

**Hình thức bộ khung**
- **A (đã chọn) — Bộ package npm + CLI**: nâng cấp tập trung, giấu cấu hình khó. Đổi lại cần kỷ luật semver và chừa điểm mở rộng.
- B — Template repo để copy: không nâng cấp được, các dự án trôi dạt. Loại.
- C — Shell deploy sẵn làm nền tảng: chỉ hợp khi mọi thứ chung một sản phẩm. Loại.

**Framework UI**: Vue (tác giả chọn vì thuận tay) thay vì React.

## 5. Thiết kế

### 5.1 Cấu trúc repo

```
/
├─ packages/
│  ├─ mf-vite/        @<scope>/mf-vite     — Vite preset: defineHost(), defineRemote()
│  ├─ mf-core/        @<scope>/mf-core     — runtime: auth, http, bus, theme, i18n, remote loader, error boundary
│  └─ create-mf/      @<scope>/create-mf   — CLI scaffold host/remote từ template
├─ playground/
│  ├─ shell/          host: layout, router gốc, đọc remotes.json
│  ├─ auth-service/   remote: màn login/đăng ký, gọi useAuth().login()
│  └─ products-service/ remote: danh sách sản phẩm, gọi httpClient có token, store riêng
├─ docs/
└─ .github/workflows/ CI (lint, test, build) + release (publish GitHub Packages)
```

Playground dùng package qua `workspace:*` — vừa để thử, vừa là ví dụ sống, vừa là nguồn tham chiếu cho template CLI.

### 5.2 `mf-vite` — Vite preset

- `defineHost(options)` và `defineRemote(options)` trả về Vite config đầy đủ (plugin Vue + `@module-federation/vite` + config shared).
- Mặc định `shared` singleton cho: `vue`, `pinia`, `vue-router`, `@<scope>/mf-core`, dùng `requiredVersion` theo bản của framework; lệch major phải báo lỗi rõ ràng (không im lặng chạy 2 bản).
- Cho phép dự án thêm shared/exposes/plugin/override Vite config (merge, không thay thế).
- Remote mặc định expose theo **hợp đồng chuẩn**: `./routes` (mảng route), tùy chọn `./setup` và widget component.
  - `./setup` là **init hook** `setup(ctx: MfContext)`: host gọi sau khi tải remote, truyền context (pinia, router, i18n, bus, auth) để remote đăng ký message i18n, listener… **Tuyệt đối không** tạo app Vue / Pinia thứ hai.
  - Widget: phiên bản này **chỉ host** được nhúng widget của remote. Remote nhúng widget của remote khác không được hỗ trợ (tránh phụ thuộc chéo, xem §4).
- **Mô hình phụ thuộc**: remote vẫn bundle bản fallback của các shared (chế độ shared thông thường, không `import: false`) để chạy standalone được; khi chạy trong host thì singleton của host thắng. Trong các package framework, `vue`/`pinia`/`vue-router` là `peerDependencies`; trong dự án host/remote sinh từ CLI chúng là dependency thường.
- Bật manifest (`mf-manifest.json`) và sinh type cho remote nếu plugin hỗ trợ ổn định.
- Xử lý sẵn async boundary (`main.ts` → `import('./bootstrap')`) trong template, không bắt người dùng nhớ.

### 5.3 `mf-core` — runtime

- **App factory**: `createMfApp({ ... })` cho host — tạo app Vue, Pinia, router, cài các plugin core. Remote ở chế độ standalone dùng `createStandaloneRemote()` để tự dựng một "host giả" tối thiểu (pinia, router, auth với mock) để dev riêng.
- **Remote loader**: đọc `remotes.json` lúc khởi động (`[{ name, entry, routePrefix, meta }]`), đăng ký qua runtime API của Module Federation, tải `./routes` lazily và gắn dưới `routePrefix` (ví dụ `/products/*`). Có thể override nguồn manifest (URL, env, hàm).
- **Error boundary**: component `<RemoteBoundary>` + xử lý lỗi tải route → hiện khung lỗi/thử lại tại chỗ, có timeout.
- **Remote quan trọng**: `remotes.json` có cờ `critical: true` (mặc định cho remote cung cấp login). Remote critical tải lỗi → host hiện trang lỗi toàn màn hình (có nút thử lại) thay vì chỉ một vùng. Route login cấu hình được: do một remote cung cấp (mặc định `/auth/login` từ `auth-service`) hoặc do host tự cung cấp.
- **Tương thích phiên bản lúc chạy**: `mf-core` cam kết tương thích ngược trong cùng một major (API công khai có type, có test hợp đồng). Remote khai báo major của `mf-core` mà nó build cùng; lệch major → loader **từ chối** tải remote đó và `<RemoteBoundary>` hiện lỗi rõ ràng (kèm log console), không tải "liều".
- **Auth**:
  - Store Pinia `useAuthStore` + composable `useAuth()` (`user`, `isAuthenticated`, `permissions`, `login()`, `logout()`, `refresh()`, `hasPermission()`).
  - **Auth adapter** (điểm mở rộng): interface kiểu `{ login, logout, refresh, fetchUser, getAccessToken? }`. Có sẵn 2 adapter: `jwtAdapter` (mặc định; access token giữ trong bộ nhớ, cách lưu refresh token cấu hình được) và `cookieAdapter` (httpOnly cookie, `withCredentials`).
  - Route guard: `meta.requiresAuth`, `meta.permissions`; chưa đăng nhập → chuyển tới route login cấu hình được.
- **httpClient**: tạo từ axios, interceptor tự gắn token, tự refresh khi 401 (gom các request đang chờ, chỉ refresh 1 lần), cho phép tạo thêm instance với baseURL khác (`createHttpClient()`).
- **Event bus**: typed, nhẹ (mitt hoặc tương đương), cho thông báo xuyên service (`notify`, sự kiện auth…). Không dùng để chia sẻ dữ liệu nghiệp vụ.
- **Theme**: CSS variables (tokens) + `useTheme()` (sáng/tối, đổi token).
- **i18n**: dựa trên `vue-i18n`, core giữ locale chung; mỗi remote tự đăng ký message của mình.
- **Store của remote**: remote tự `defineStore` bình thường; store tự đăng ký vào Pinia của host khi dùng. Quy ước đặt id store có tiền tố tên remote (`products/cart`) để tránh trùng.

### 5.4 `create-mf` — CLI

- `pnpm create @<scope>/mf <tên>` → hỏi loại (host / remote), sinh dự án từ template (dựa trên playground), cấu hình sẵn `.npmrc` cho GitHub Packages, `remotes.json` mẫu (host), `defineRemote` mẫu (remote).

### 5.5 Playground — luồng minh họa bắt buộc

1. Mở shell → layout + menu, các mục menu lấy từ `remotes.json`.
2. Vào `/products` khi chưa đăng nhập → bị chuyển tới `/auth/login` (do `auth-service` cung cấp).
3. Đăng nhập (mock API) → `useAuth()` cập nhật → quay lại `/products`.
4. `products-service` gọi `httpClient.get('/products')` → request mang token; store `products/*` riêng của remote.
5. Tắt server của `products-service` → vùng nội dung hiện lỗi, shell và auth vẫn chạy.
6. Chạy `products-service` standalone → vẫn dev được với auth mock.

### 5.6 Công cụ, chất lượng, phát hành

- ESLint + Prettier, TypeScript strict, Vitest (unit cho mf-core, mf-vite), có thể thêm 1 e2e (Playwright) cho luồng 5.5.
- `pnpm dev` chạy toàn bộ playground; có lệnh chạy riêng từng app.
- Versioning bằng **Changesets**, các package framework **cùng version** (fixed group) để người dùng chỉ cần nhớ 1 số version.
- GitHub Actions: CI trên PR; release workflow publish lên `npm.pkg.github.com` bằng `GITHUB_TOKEN`.
- README: cài đặt, cấu hình `.npmrc`, hợp đồng remote, cách mở rộng auth adapter.

## 6. Quyết định do Claude đưa ra (tác giả có thể sửa)

- Monorepo pnpm; `@module-federation/vite`; remote đăng ký runtime qua `remotes.json`.
- Host giữ router gốc + layout; remote expose `./routes`.
- Không UI lib trong core, chỉ theme tokens.
- Theme, i18n, event bus đặt ở core cùng kiểu auth.
- JWT adapter làm mặc định, có sẵn cookie adapter.
- Changesets, version cố định chung cho các package (bump kéo theo cả gói không ảnh hưởng vì range tương thích tính theo major).
- Remote bundle fallback của shared để chạy standalone; host singleton thắng lúc chạy.
- `mf-core` tương thích ngược trong một major; lệch major → từ chối remote + hiện lỗi.
- `./setup` là init hook nhận context của host; widget chỉ host nhúng.
- Remote cung cấp login được đánh dấu `critical`; lỗi → trang lỗi toàn màn hình. Host có thể tự cung cấp login nếu muốn.

## 7. Để lại cho người xây

- Phiên bản cụ thể của Vite/Vue/plugin (chọn stable mới nhất, kiểm tra tương thích dev mode của `@module-federation/vite`).
- Cách xử lý CSS của module expose (kiểm chứng CSS của remote được nạp đúng cả dev lẫn build).
- Chi tiết API nội bộ, tên file, cấu trúc template.
- Thư viện mock API trong playground (MSW hoặc mock server nhỏ).

## 8. Scope và phát hành

- Scope npm: **`@nineh-fe-base`** → `@nineh-fe-base/mf-vite`, `@nineh-fe-base/mf-core`, `@nineh-fe-base/create-mf` (mọi chỗ ghi `@<scope>` ở trên hiểu là scope này).
- Việc publish lên GitHub Packages **hiện mới là định hướng**, chưa làm ngay. Phiên bản này chỉ cần: package có `publishConfig` trỏ `npm.pkg.github.com`, build ra được bản publishable, Changesets đã cài; workflow release có thể viết sẵn nhưng không bắt buộc chạy. Khi publish thật, cần user/org GitHub tên `nineh-fe-base` sở hữu repo (GitHub Packages yêu cầu scope trùng owner).
- Trong thời gian chưa publish, playground dùng package qua `workspace:*`; CLI tạo dự án bên ngoài có thể trỏ tới bản local (`link:`/`file:`) như phương án tạm.
