# @nineh2303/mf-vite

Helper Vite cho Module Federation (dùng `@module-federation/vite`).

```ts
// host
import { defineHost } from '@nineh2303/mf-vite'
export default defineHost({ name: 'shell', port: 5000 })

// remote
import { defineRemote } from '@nineh2303/mf-vite'
export default defineRemote({
  name: 'products',
  port: 5002,
  exposes: { './routes': './src/routes.ts', './setup': './src/setup.ts' },
})
```

- `name` phải là JS identifier (là tên container federation).
- Tự cấu hình shared singleton: `vue`, `pinia`, `vue-router`, `vue-i18n`, `@nineh2303/mf-core` (thêm/ghi đè qua `shared`; thêm cấu hình Vite qua `vite`).
- Remote tự expose thêm `./mf-meta` (`{ name, coreVersion }`) để host kiểm tra tương thích version.
- `peerDependencies`: `vite`, `vue`.


### Tailwind và ui

- `defineHost`/`defineRemote` tự thêm plugin `@tailwindcss/vite` (Tailwind v4). Đặt `tailwind: false` để tắt.
- `defineRemote` (khi bật Tailwind) thêm plugin `nineh-mf:scope-remote-css`: mọi CSS của remote (file `.css`, `<style>` của SFC; trừ `?raw`/`?url`/`?inline` và `host.css` của ui dùng cho standalone) được bọc trong `@scope ([data-mf-remote="<name>"]) to ([data-mf-remote])`, cả khi `vite build` lẫn `vite dev`. Nhờ vậy utility của remote (vd. `.hidden`) không đè utility của host (vd. `md:flex`) và remote không thể style ra ngoài vùng `[data-mf-remote]` của mình (thiết kế có chủ ý). Giữ toàn cục: layer `theme`, `@property`, `@keyframes`, `@font-face`, câu lệnh `@layer`, `@import`, và rule có subject là `[data-mf-remote…]` (override token). Plugin chạy ở pha normal, sau Tailwind (`enforce: 'pre'`) và `vite:css`, trước `vite:css-post`, nên thấy CSS đã biên dịch. Trình duyệt: Chrome/Edge 118+, Safari 17.4+, Firefox 146+.
- Nếu `package.json` của project (ở thư mục chạy lệnh, cwd) có `@nineh2303/ui` trong `dependencies`/`devDependencies`, `@nineh2303/ui` và `reka-ui` tự được thêm vào shared singleton (`reka-ui` lấy `requiredVersion` từ `package.json` của ui). Project không dùng ui thì không đổi gì.

Xem README gốc của repo để biết hợp đồng remote đầy đủ. Repo: https://github.com/Nineh2303/base-fe.
