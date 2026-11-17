# %%name%%

Host (shell) application built on `@nineh-fe-base/mf-core` and `@nineh-fe-base/mf-vite`.

```bash
npm install
npm run dev        # http://localhost:%%port%%
npm run typecheck
npm run build
```

Register remotes in `public/remotes.json`. The auth adapter in `src/bootstrap.ts` expects a backend at `/api`.

## Tailwind and UI

Tailwind v4 is enabled by `@nineh-fe-base/mf-vite`. `src/bootstrap.ts` imports `@nineh-fe-base/ui/styles/host.css` (preflight, theme tokens, utilities), and `src/Layout.vue` mounts the single `<Toaster />` for the whole app. Components come from `@nineh-fe-base/ui`; copy one into the project with `npx @nineh-fe-base/create-mf ui add <component>`.
