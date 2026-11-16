# @nineh-fe-base/create-mf

Sinh project host hoặc remote:

```bash
npm create @nineh-fe-base/mf <name> -- --kind host|remote --port N
```

- `--kind host|remote` (bắt buộc nếu không chạy tương tác), `--port` mặc định 5000 (host) / 5010 (remote).
- `<name>` phải là JS identifier (không dấu gạch ngang); host còn phải là tên npm hợp lệ (chữ thường). Tên package npm được suy ra dạng kebab-case (`myOrders` -> `my-orders`).
- Sau khi sinh: `cd <name> && npm install && npm run dev`.

Template nằm trong `templates/` (có `.npmrc` trỏ `@nineh-fe-base` tới GitHub Packages; cần token `read:packages`).
Repo URL trong `package.json` (`nineh-fe-base/mf-framework`) là giá trị tạm.
