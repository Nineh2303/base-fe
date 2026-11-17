# @nineh-fe-base/create-mf

Sinh project host hoặc remote:

```bash
npm create @nineh-fe-base/mf <name> -- --kind host|remote --port N
```

- `--kind host|remote` (bắt buộc nếu không chạy tương tác), `--port` mặc định 5000 (host) / 5010 (remote).
- `<name>` phải là JS identifier (không dấu gạch ngang); host còn phải là tên npm hợp lệ (chữ thường). Tên package npm được suy ra dạng kebab-case (`myOrders` -> `my-orders`).
- Sau khi sinh: `cd <name> && npm install && npm run dev`.


## `ui add`: eject component

```bash
npx @nineh-fe-base/create-mf ui add <component...> [--dir src/components/ui] [--force]
```

Sao chép source component từ `@nineh-fe-base/ui` đã cài vào `src/components/ui/<tên>/` (hoặc `--dir`). Từ đó service sở hữu bản sao đó. Import nội bộ được viết lại thành `@nineh-fe-base/ui` (trừ import tới component anh em cũng được eject cùng lệnh hoặc đã có trong thư mục đích). Từ chối ghi đè file có sẵn nếu thiếu `--force`; tên không hợp lệ thì in danh sách component. Chạy từ repo này khi chưa publish: build trước bằng `npm run build -w @nineh-fe-base/create-mf`.

Project sinh ra đã dùng Tailwind và `@nineh-fe-base/ui` (host import `host.css` trong `bootstrap.ts`; remote import `src/style.css` từ `routes.ts`).
Template nằm trong `templates/` (có `.npmrc` trỏ `@nineh-fe-base` tới GitHub Packages; cần token `read:packages`).
Repo URL trong `package.json` (`nineh-fe-base/mf-framework`) là giá trị tạm.
