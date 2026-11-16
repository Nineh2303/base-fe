# @nineh-fe-base/mf-core

Runtime lõi cho host/remote: singleton được chia sẻ giữa mọi app qua Module Federation.

Export chính:

- `createMfApp({ root, routes, remotes, auth, api })` (host; tuỳ chọn thêm `loginPath`, `forbiddenPath`, `theme`, `i18n`, `history`). `remotes` là URL tới `remotes.json`, object hoặc hàm async; trả `{ app, ctx, mount }`.
- `createStandaloneRemote({ name, routes, routePrefix, api, setup?, auth?, root? })` (chạy remote độc lập; `auth` mặc định là mock tự đăng nhập; route được đặt tên `<name>/...` giống khi chạy trong host).
- Auth: `jwtAdapter`, `cookieAdapter`, `createMockAuthAdapter`, interface `AuthAdapter`, `useAuth`, `useAuthStore` (store id `mf-core/auth`), `installAuthGuard`.
- `createHttpClient`, `createBus`, `createTheme`/`useTheme` (CSS variables `--mf-*`), `createMfI18n`/`registerMessages`, `useMfContext`, `RemoteBoundary`, `RemoteErrorPage`.
- Kiểu: `RemoteSetup`, `MfContext`, `RemoteEntry`, `AuthUser`...

### HTTP client và token

`createHttpClient({ baseURL, auth, withCredentials, trustedOrigins })` (và `ctx.http` qua `createMfApp({ api: { baseURL, trustedOrigins } })`) chỉ gắn `Authorization: Bearer …` và xử lý 401/refresh cho:

- URL tương đối (đi tới `baseURL`, hoặc origin của trang khi không có `baseURL`);
- URL tuyệt đối cùng origin với `baseURL` của instance;
- origin nằm trong `trustedOrigins` (ví dụ `['https://files.example.com']`).

Mọi origin khác (kể cả `//host/...` hay `baseURL` ghi đè theo request) không nhận token, và 401 từ đó không kích hoạt refresh/logout.

`peerDependencies`: `vue`, `pinia`, `vue-router`, `vue-i18n`, `@module-federation/runtime`.

Chính sách version: tương thích ngược trong một major; khi còn `0.x`, tăng minor là breaking (host 0.1.x từ chối remote build với 0.2.x). Xem README gốc.
Repo URL trong `package.json` (`nineh-fe-base/mf-framework`) là giá trị tạm.
