# %%name%%

Host (shell) application built on `@nineh-fe-base/mf-core` and `@nineh-fe-base/mf-vite`.

```bash
npm install
npm run dev        # http://localhost:%%port%%
npm run typecheck
npm run build
```

Register remotes in `public/remotes.json`. The auth adapter in `src/bootstrap.ts` expects a backend at `/api`.
