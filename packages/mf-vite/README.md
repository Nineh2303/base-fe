# @nineh-fe-base/mf-vite

Helper Vite cho Module Federation (dùng `@module-federation/vite`).

```ts
// host
import { defineHost } from '@nineh-fe-base/mf-vite'
export default defineHost({ name: 'shell', port: 5000 })

// remote
import { defineRemote } from '@nineh-fe-base/mf-vite'
export default defineRemote({
  name: 'products',
  port: 5002,
  exposes: { './routes': './src/routes.ts', './setup': './src/setup.ts' },
})
```

- `name` phải là JS identifier (là tên container federation).
- Tự cấu hình shared singleton: `vue`, `pinia`, `vue-router`, `vue-i18n`, `@nineh-fe-base/mf-core` (thêm/ghi đè qua `shared`; thêm cấu hình Vite qua `vite`).
- Remote tự expose thêm `./mf-meta` (`{ name, coreVersion }`) để host kiểm tra tương thích version.
- `peerDependencies`: `vite`, `vue`.

Xem README gốc của repo để biết hợp đồng remote đầy đủ. Repo URL trong `package.json` (`nineh-fe-base/mf-framework`) là giá trị tạm, cần đổi theo repo thật.
