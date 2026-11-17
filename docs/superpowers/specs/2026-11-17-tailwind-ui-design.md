# Tailwind + `@nineh-fe-base/ui` (shadcn-vue): Design

**Date:** 2026-11-17 · **Builds on:** `2026-11-16-vue-mf-framework-design.md` (branch `feat/framework`)

## Intent

The base has no styling system yet. Each app writes inline styles, and the only shared piece is the `--mf-*` CSS variables that `mf-core/theme` writes onto `<html>`. Projects built on the base need two things:

- **Tailwind**, decided by the user.
- **A shared Vue component library**, so that the host and every remote look like one product.

The user chose **shadcn-vue** (Reka UI + Tailwind) packaged as `@nineh-fe-base/ui`, and **approach A**: one shared package, plus an eject path. The user's explicit requirement is that **each service can customise the UI for itself**.

## Goals

- Every app made with `create-mf`, and every playground app, has Tailwind v4 working with zero setup.
- `@nineh-fe-base/ui` is a compiled package of shadcn-vue components, loaded as a **shared singleton** at runtime. Host and remotes therefore use one copy.
- Theme tokens are the single source of truth.
  - Tailwind colours and component colours read `--mf-*` variables.
  - `theme.setMode('dark')` restyles the host and every remote at once.
- **Per-service customisation** comes in four layers, from lightest to heaviest:
  1. **Scoped tokens.** A service overrides `--mf-*` variables only inside its own area (`[data-mf-remote="<name>"]`). Its dialogs, dropdowns and other portaled content keep the override.
  2. **Class/props at the call site.** `<Button class="rounded-full">`: class merging via `tailwind-merge` lets the caller's class win.
  3. **Variant extension.** The package exports its `cva` variant definitions (`buttonVariants`, …), so a service can build `brand` variants on top.
  4. **Eject.** `npx @nineh-fe-base/create-mf ui add <component…>` copies a component's source into the service's `src/components/ui/<name>/`. From then on the service owns that copy and bundles it locally.
- A remote's styles work both inside the host and standalone.

## Non-goals

- The full shadcn-vue catalogue. A starter set ships now; more components get added later.
- A form-validation library (vee-validate/zod), Storybook, visual regression tests.
- Per-remote Tailwind class prefixes or CSS isolation (shadow DOM).
- Supporting a remote that uses a *different* Tailwind major than the host.

## Anti-goals (failure even if it "works")

- Two copies of the reset (preflight) or base styles fighting each other, which happens when each remote ships its own.
- A remote's CSS leaking global overrides. For example, a remote redefining `--color-primary` on `:root` must not restyle the host.
- A remote page that looks right standalone but is unstyled inside the host, because its CSS never loaded.
- Customisation that forces forking the whole package.

## Approaches considered

- **A: shared package + eject (chosen).**
  - Gains: consistency, one fix lands everywhere, smaller bundles.
  - Cost: a service cannot edit the package source in place; layer 4 covers that.
- **B: pure copy-paste per service.** Total freedom, but services drift apart, fixes must be copied by hand, and bundles duplicate. Rejected because it defeats the shared base.
- **PrimeVue / Nuxt UI.** Considered and not chosen by the user in favour of owning the component code.

## Design

### 1. Tailwind in `mf-vite`

- `defineHost` and `defineRemote` add `@tailwindcss/vite` by default.
  - The option `tailwind?: boolean` defaults to `true`; `false` opts out.
  - `@tailwindcss/vite` and `tailwindcss` become dependencies of `mf-vite`.
- `@nineh-fe-base/ui` and `reka-ui` are added to the shared config **as singletons**, but only when the project's `package.json` lists `@nineh-fe-base/ui`. A project without the ui package is unaffected.

### 2. CSS entry points (shipped by `@nineh-fe-base/ui`)

**`@nineh-fe-base/ui/styles/host.css`.** The host imports it once. It contains:

- the full Tailwind import (preflight + theme + utilities);
- the token mapping (below);
- the dark variant;
- `@source` pointing at the ui package's dist, so the classes used inside components get generated.

**`@nineh-fe-base/ui/styles/remote.css`.** A remote imports it. It contains:

- Tailwind theme + utilities **without preflight/base**;
- the same token mapping and dark variant;
- the same `@source`.

Two rules on what happens to these styles:

- A remote's own CSS is imported from a module the remote **exposes** (its `./routes` entry). That way, when the host loads the remote, the remote's CSS loads with it.
- In standalone mode the remote's `main.ts` *also* imports `host.css`, so a standalone remote gets preflight.

Duplicate utility rules between the host and remotes are acceptable. They are identical as long as the theme mapping comes from the same package.

**Builder must verify:** `@module-federation/vite` emits and injects the CSS of exposed modules when a remote loads inside the host. This is the riskiest assumption. An e2e test pins it (see Testing).

### 3. Theme tokens (`mf-core/theme`)

`DEFAULT_TOKENS` is extended to the shadcn token set, keeping the existing keys so nothing breaks.

- **New keys:** `color-background`, `color-foreground`, `color-card`, `color-card-foreground`, `color-popover`, `color-popover-foreground`, `color-primary-foreground`, `color-secondary`, `color-secondary-foreground`, `color-muted`, `color-muted-foreground`, `color-accent`, `color-accent-foreground`, `color-destructive`, `color-destructive-foreground`, `color-input`, `color-ring`.
- **Existing keys:** `color-primary`, `color-bg`, `color-text`, `color-border`, `color-danger`, `color-on-primary`, `radius`, `font-family`.
- **Aliases:** where an old key and a new key mean the same thing (`bg`/`background`, `text`/`foreground`, `danger`/`destructive`, `on-primary`/`primary-foreground`), both are kept with equal default values.

The ui CSS maps them through Tailwind v4 `@theme inline`, for example `--color-primary: var(--mf-color-primary)` and `--radius-md: var(--mf-radius)`. Classes like `bg-primary` therefore follow the runtime theme.

Dark mode is `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`, which matches the existing `data-theme` attribute.

### 4. Per-service scope

**The scope element.** `RemoteBoundary` (host) and `createStandaloneRemote` (standalone) wrap the remote's content in an element with `data-mf-remote="<name>"` and `display: contents`. CSS variables inherit through `display: contents`.

**How a service overrides tokens:**

```css
[data-mf-remote="orders"] { --mf-color-primary: #16a34a; }
```

The `create-mf` remote template ships this as a commented example in its CSS.

**Portaled content.** Teleported content (Dialog, DropdownMenu, Select, Tooltip, Toast) would escape the scope. To keep it inside:

- the scope element hosts a portal container;
- `mf-core` provides it through an injection key;
- the ui components pass it as Reka UI's portal `to`, falling back to `body` when nothing is provided.

`mf-core` owns the injection key and exports it. ui depends on `mf-core` as a peer.

Accepted deviation: Toast is the exception, because the single host `Toaster` lives at host scope, so toasts use host tokens rather than the calling remote's scoped tokens.

### 5. `@nineh-fe-base/ui` package

**Starter components:**

- Button, Input, Label, Textarea, Checkbox, Switch, Select
- Card, Badge, Avatar, Separator, Skeleton
- Dialog, DropdownMenu, Tooltip, Tabs, Table, Toast (vue-sonner)

**Also exported:**

- `cn()` (clsx + tailwind-merge)
- every `*Variants` cva definition
- the portal injection helper

**Build.** Vite lib mode with vite-plugin-dts, the same way `mf-core` is built.

**Published files:**

- `dist/`
- `styles/`
- `src/`, which eject copies from

**Dependencies:**

- `reka-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-vue-next`, `vue-sonner` as dependencies;
- `vue` and `@nineh-fe-base/mf-core` as peers.

The package joins the Changesets `fixed` group with the other three.

### 6. Eject command

`create-mf` gains a subcommand: `create-mf ui add <component…> [--dir src/components/ui] [--force]`.

- It resolves the installed `@nineh-fe-base/ui/src/components/<name>/` and copies it into the target directory.
- It rewrites internal imports (for example `../../lib/utils`) to `@nineh-fe-base/ui`, so the copy keeps using the shared `cn` and helpers.
- It refuses to overwrite existing files without `--force`.
- It lists the available components when given an unknown name.

### 7. Templates and playground

- **Templates.** The `create-mf` host and remote templates use Tailwind and the ui package. The sample pages use Button and Card; the host Layout and Login use ui components; the remote shows the commented scoped-token example.
- **Playground.**
  - The shell layout, the auth-service login and the products list are rewritten with ui components (Table, Button, Card…). The inline styles go away.
  - `products-service` sets a scoped token override, so the per-service layer is demonstrated.
- **Error pages.** `RemoteBoundary` and `RemoteErrorPage` keep their inline styles. Core must not depend on ui.

## Testing

**Unit tests:**

- `mf-vite`: the tailwind plugin is on by default and `false` turns it off; ui/reka-ui become singletons only when ui is a dependency.
- `mf-core`: the token defaults contain all keys; the scope element and portal provide work in both host and standalone.
- `ui`: `cn` merging, the variant outputs, and portal `to` (fallback included).
- `create-mf ui add`: copy, import rewrite, overwrite refusal, unknown name.

**e2e tests (pinning the risky assumptions):**

1. Inside the shell, a products-service ui Button has the computed background of its **scoped** primary token. This proves the remote CSS loaded *and* the scope works.
2. A Dialog opened from products-service keeps the scoped token, which proves the portal stays in scope.
3. Toggling dark mode changes the computed background of a host element and of a remote element.
4. A host element is not affected by the products-service scoped override.

## Left to the builder

- Exact versions: the latest stable Tailwind v4, reka-ui and the rest.
- Exact component source adapted from shadcn-vue.
- The build config for shipping `.vue` components.
- How the `@source` path is expressed so it resolves from a consumer's `node_modules`.
- Default dark-mode colour values for the new tokens.

## Calls settled after the builder review

1. **Who generates which classes.** Each app compiles its own CSS. Tailwind v4 automatically scans that app's own source through `@tailwindcss/vite`, and the `@source` in the ui stylesheet adds the ui package. A remote's own classes therefore come from the remote's build, and they reach the host through the CSS of its exposed `./routes` module. The host never scans remote code.
2. **Layer strategy.**
   - `host.css` and `remote.css` both declare the same order, `@layer theme, base, components, utilities;`, and all Tailwind output lives inside those layers.
   - Scoped token overrides are written **unlayered**. They are only variable declarations on `[data-mf-remote]`, so they never compete with utilities.
   - Because the layer order is fixed up front, load order does not change which layer wins.
   - Inside one layer, equal-specificity rules still follow load order, so `defineRemote` wraps the remote's CSS (except the `theme` layer, `@property`, `@keyframes`, `@font-face`, `@layer` statements, `@import` and rules targeting the scope element itself) in `@scope ([data-mf-remote="<name>"]) to ([data-mf-remote])`, and a remote cannot style outside its own area.
3. **Scope element in `RemoteBoundary`.**
   - The `data-mf-remote` wrapper (`display: contents`) is the **outermost** element and wraps both the error frame and the Suspense content.
   - The portal container is a plain `<div data-mf-portal>` placed as the last child inside the wrapper.
   - `createStandaloneRemote` renders the same structure.
   - The remote name comes from the manifest entry.
4. **Portal injection key.** The key is `Symbol.for('nineh-fe-base/ui-portal')`, so it stays stable even if a second copy is ever loaded. Ejected components import the helper from `@nineh-fe-base/ui`, which is shared, and never inline it.
5. **ui detection in `mf-vite`.**
   - The project's `package.json` in the directory the command runs in (`process.cwd()`) is checked in `dependencies` and `devDependencies`, the same file the existing version resolution reads.
   - Presence is enough, so a workspace link counts.
   - `reka-ui` is shared together with ui, and its `requiredVersion` is taken from ui's own `package.json`.
6. **Standalone CSS.** `main.ts` imports `host.css` and the exposed module imports `remote.css`. Theme and utilities are duplicated in standalone only, which is acceptable. The fixed layer order (call 2) keeps preflight below the utilities whatever the load order.
7. **Eject import rewrite.** Imports of `lib/utils` and helpers are rewritten to `@nineh-fe-base/ui`. Imports of a sibling component (for example `../button`) are rewritten the same way, **unless** that sibling is ejected in the same command or already exists in the target directory. In that case the relative import is kept.
