# %%name%%

Host (shell) application built on `@nineh2303/mf-core` and `@nineh2303/mf-vite`.

```bash
npm install
npm run dev        # http://localhost:%%port%%
npm run typecheck
npm run build
```

Register remotes in `public/remotes.json`. The auth adapter in `src/bootstrap.ts` expects a backend at `/api`.

## Tailwind and UI

Tailwind v4 is enabled by `@nineh2303/mf-vite`. `src/bootstrap.ts` imports `@nineh2303/ui/styles/host.css` (preflight, theme tokens, utilities), and `src/Layout.vue` mounts the single `<Toaster />` for the whole app. Components come from `@nineh2303/ui`; copy one into the project with `npx @nineh2303/create-mf ui add <component>`.
