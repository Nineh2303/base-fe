# @nineh-fe-base/mf-core

Runtime lõi cho host/remote: singleton được chia sẻ giữa mọi app qua Module Federation.

Export chính:

- `createMfApp({ root, routes, remotes, auth, api })` (host; tuỳ chọn thêm `loginPath`, `forbiddenPath`, `theme`, `i18n`, `history`). `remotes` là URL tới `remotes.json`, object hoặc hàm async; trả `{ app, ctx, mount }`.
- `createStandaloneRemote({ name, routes, routePrefix, api, setup?, auth?, root? })` (chạy remote độc lập; `auth` mặc định là mock tự đăng nhập; route được đặt tên `<name>/...` giống khi chạy trong host).
- Auth: `jwtAdapter`, `cookieAdapter`, `createMockAuthAdapter`, interface `AuthAdapter`, `useAuth` (`user`, `status`, `isAuthenticated`, `permissions`, `login`, `logout`, `refresh`, `hasPermission`, `init`), `useAuthStore` (store id `mf-core/auth`), `installAuthGuard`.
- `createHttpClient` (tuỳ chọn `trustedOrigins`), `createBus`, `createTheme`/`useTheme` (CSS variables `--mf-*`), `createMfI18n`/`registerMessages`, `useMfContext`, `RemoteBoundary`, `RemoteErrorPage`.
- Kiểu: `RemoteSetup`, `MfContext`, `RemoteEntry`, `AuthUser`...

### Host layout & widgets

- `useMfLayout()` → `ComputedRef<boolean>`: `false` khi route hiện tại tắt layout (`meta.mfLayout === false`, ví dụ trang lỗi của remote `critical`); root layout dùng để ẩn header/menu.
- `defineRemoteComponent('<remote>/<expose>')`: widget của remote nhúng vào trang host — component async bọc trong `RemoteBoundary` (lỗi/timeout hiện khung lỗi + thử lại tại chỗ). **Remote phải đã được tải trước** (khai báo trong `remotes.json` và `mount()` đã chạy `loadAll`), vì id được resolve qua runtime federation đã `register`.
- `useMfContext().remotes`: `Ref<LoadedRemote[]>` — danh sách remote với `status: 'loading' | 'ready' | 'error'` (+ `error`, `menu`), dùng để dựng menu hoặc hiện trạng thái.
- `RemoteBoundary` / `RemoteErrorPage` nhận thêm `title?`, `retryLabel?` (mặc định tiếng Việt). Lỗi setup/render/lifecycle/tải module chiếm khung; lỗi trong event handler chỉ log + chuyển tới `app.config.errorHandler`, nội dung giữ nguyên.

### Export nâng cao

`createRemoteLoader`, `mfRuntime` (runtime federation thật), `parseManifest`, `loadManifest` (đọc/kiểm tra `remotes.json`), và tuỳ chọn `trustedOrigins` của `createHttpClient` / `createMfApp({ api })` (xem dưới). Thường không cần dùng trực tiếp — `createMfApp` đã gọi.

### Remote standalone và auth

`createStandaloneRemote` mặc định dùng mock auth tự đăng nhập. Chế độ standalone **không có trang `/auth/login`** (trang đó do host / remote auth cung cấp), nên khi đổi sang `jwtAdapter` lúc chạy standalone cần tự thêm một route đăng nhập vào `routes` của remote và truyền `loginPath` tương ứng.

### HTTP client và token

`createHttpClient({ baseURL, auth, withCredentials, trustedOrigins })` (và `ctx.http` qua `createMfApp({ api: { baseURL, trustedOrigins } })`) chỉ gắn `Authorization: Bearer …` và xử lý 401/refresh cho:

- URL tương đối (đi tới `baseURL`, hoặc origin của trang khi không có `baseURL`);
- URL tuyệt đối cùng origin với `baseURL` của instance;
- origin nằm trong `trustedOrigins` (ví dụ `['https://files.example.com']`).

Mọi origin khác (kể cả `//host/...` hay `baseURL` ghi đè theo request) không nhận token, và 401 từ đó không kích hoạt refresh/logout.

`peerDependencies`: `vue`, `pinia`, `vue-router`, `vue-i18n`, `@module-federation/runtime`.

Chính sách version: tương thích ngược trong một major; khi còn `0.x`, tăng minor là breaking (host 0.1.x từ chối remote build với 0.2.x). Xem README gốc.
Repo URL trong `package.json` (`nineh-fe-base/mf-framework`) là giá trị tạm.
