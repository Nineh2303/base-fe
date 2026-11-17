# @nineh-fe-base/ui

shadcn-vue style components (Reka UI + Tailwind v4) for nineh-fe-base apps. Compiled, shared as a Module Federation singleton, and themed by the `--mf-*` tokens of `@nineh-fe-base/mf-core`.

## Styles

- Host (once, e.g. in `bootstrap.ts`): `import '@nineh-fe-base/ui/styles/host.css'` (Tailwind with preflight, token mapping, `dark` variant).
- Remote: `@import '@nineh-fe-base/ui/styles/remote.css';` in a `src/style.css` that the exposed `./routes` module imports (same as host.css but no preflight). A standalone remote also imports `host.css` in its bootstrap.
- Both files declare `@layer theme, base, components, utilities;`. Your own unlayered CSS beats utilities; wrap it in `@layer components` if utilities should win.
- A remote's CSS is scoped to its `[data-mf-remote="<name>"]` subtree: `@nineh-fe-base/mf-vite` wraps it in `@scope ([data-mf-remote="<name>"]) to ([data-mf-remote])` at build and dev time. Without this, a remote's `.hidden` (same layer and specificity, loaded later) would beat a host's `md:flex`. A remote therefore cannot style anything outside its area, by design. The `theme` layer, `@property`, `@keyframes`, `@font-face`, `@layer` statements, `@import` and rules that target the scope element itself (token overrides) stay global. Browser support for `@scope`: Chrome/Edge 118+, Safari 17.4+, Firefox 146+.

## Components

Button, Input, Label, Textarea, Checkbox, Switch, Select, Card, Badge, Avatar, Separator, Skeleton, Dialog, DropdownMenu, Tooltip, Tabs, Table, Toast (`Toaster` + `toast`, from vue-sonner).

```vue
<script setup lang="ts">
import { Button, Card, CardContent, CardHeader, CardTitle } from '@nineh-fe-base/ui'
</script>
<template>
  <Card>
    <CardHeader><CardTitle>Hello</CardTitle></CardHeader>
    <CardContent><Button class="rounded-full">Save</Button></CardContent>
  </Card>
</template>
```

Also exported: `cn()` (clsx + tailwind-merge), every `*Variants` cva definition (`buttonVariants`, `badgeVariants`, ...) and `usePortalTo()`.

## Customising per service

1. **Scoped tokens**: override `--mf-*` inside `[data-mf-remote='<name>'] { ... }` (unlayered). Overlays stay in the scope.
2. **Class at the call site**: `<Button class="rounded-full">`; the caller's class wins via tailwind-merge.
3. **Variants**: build on `buttonVariants` etc. with `cn`.
4. **Eject**: `npx @nineh-fe-base/create-mf ui add <component...> [--dir src/components/ui] [--force]` copies the component source into your project.

## Overlays and Toaster

Dialog, DropdownMenu, Select and Tooltip teleport into the enclosing service's `[data-mf-portal]` element (via `usePortalTo()`), falling back to `body`, so scoped tokens apply to them. Mount a single `Toaster` per app (the host Layout): vue-sonner shares one global store, so every mounted `Toaster` shows every `toast()`. Because that single Toaster lives at host scope, toasts use the host's tokens, not a remote's scoped tokens, even when a remote calls `toast()` (an accepted deviation from spec §4).

Peer dependencies: `vue`, `@nineh-fe-base/mf-core`, `tailwindcss` (v4). The Tailwind plugin is added by `@nineh-fe-base/mf-vite` by default.
