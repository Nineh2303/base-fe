# @nineh-fe-base/ui

shadcn-vue style components (Reka UI + Tailwind v4) for nineh-fe-base apps.

- Host: `@import '@nineh-fe-base/ui/styles/host.css';`
- Remote: `@import '@nineh-fe-base/ui/styles/remote.css';`

Colours follow the `--mf-*` theme tokens from `@nineh-fe-base/mf-core`.

Mount a single `Toaster` per app (the host Layout): vue-sonner shares one global store, so every mounted `Toaster` shows every `toast()`.
