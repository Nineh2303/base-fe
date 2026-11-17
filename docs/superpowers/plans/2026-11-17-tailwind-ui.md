# Tailwind + `@nineh-fe-base/ui` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tailwind v4 works by default in every host and remote. The new `@nineh-fe-base/ui` package provides shadcn-vue components, shared as a singleton, that each service can customise in four layers: scoped tokens, class/props, variants, and eject.

**Architecture:**
- `mf-core` gains the shadcn token set, a `data-mf-remote` scope wrapper with a portal container inside `RemoteBoundary`, and a portal-target injection.
- `ui` is a Vite-lib package of Reka-UI-based components with `host.css` and `remote.css` entries that map Tailwind's theme onto `--mf-*` variables.
- `mf-vite` adds `@tailwindcss/vite`, and shares `ui` and `reka-ui` when the project depends on ui.
- `create-mf` gains `ui add` (eject).
- Templates and playground move to ui.

**Tech Stack:** Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/vite`), reka-ui, class-variance-authority, clsx, tailwind-merge, lucide-vue-next, vue-sonner, Vite lib mode, vite-plugin-dts, Vitest, @vue/test-utils, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-tailwind-ui-design.md` (read its "Calls settled after the builder review" section; those calls are binding).

## Global Constraints

- **Package manager:** npm workspaces only, never pnpm. Do not bypass the organisation's npm security wrapper. If an install is blocked, report BLOCKED.
- **Versions:** use the latest stable version of every new dependency that `npm view <pkg> version` reports. Tailwind must be v4.x.
- **Package:** the new package is `packages/ui`, named `@nineh-fe-base/ui`, version `0.1.0` (same as the others). It has `publishConfig.registry` `https://npm.pkg.github.com`, the same `repository` shape (`directory: packages/ui`), and `files: ["dist", "styles", "src"]`.
- **Dependency directions:**
  - `ui` peer-depends on `vue` and `@nineh-fe-base/mf-core`.
  - `mf-core` must not import `ui`.
  - `RemoteBoundary` and `RemoteErrorPage` keep their inline styles.
- **Token names** (keys of `DEFAULT_TOKENS[mode]`, written as `--mf-<key>`):
  - Keep the existing `color-primary`, `color-bg`, `color-text`, `color-border`, `color-danger`, `color-on-primary`, `radius`, `font-family`.
  - Add `color-background`, `color-foreground`, `color-card`, `color-card-foreground`, `color-popover`, `color-popover-foreground`, `color-primary-foreground`, `color-secondary`, `color-secondary-foreground`, `color-muted`, `color-muted-foreground`, `color-accent`, `color-accent-foreground`, `color-destructive`, `color-destructive-foreground`, `color-input`, `color-ring`.
  - Alias pairs have equal defaults in each mode: `bg`=`background`, `text`=`foreground`, `danger`=`destructive`, `on-primary`=`primary-foreground`.
- **Scope element:** `<div data-mf-remote="<remote name>" style="display:contents">` is the outermost element rendered by `RemoteBoundary`. Its last child is `<div data-mf-portal></div>`.
- **Portal key:** `Symbol.for('nineh-fe-base/ui-portal')`, exported from mf-core as `MF_PORTAL_KEY`.
- **CSS layer order:** both ui CSS files begin with `@layer theme, base, components, utilities;`.
  - `host.css` includes preflight; `remote.css` does not.
  - Scoped token overrides are written unlayered.
  - Dark variant: `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));`.
- **Component set:**
  - Button, Input, Label, Textarea, Checkbox, Switch, Select, Card, Badge, Avatar, Separator, Skeleton, Dialog, DropdownMenu, Tooltip, Tabs, Table, Toast (vue-sonner).
  - Each lives in `packages/ui/src/components/<kebab-name>/`, with an `index.ts` barrel.
- **Eject command:** `create-mf ui add <component…> [--dir src/components/ui] [--force]`.
- **Runtime version check:** the existing compatibility rule stays (0.x minor = breaking). ui joins the Changesets `fixed` group automatically through the `@nineh-fe-base/*` glob.
- **Commits:** conventional commits, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on branch `feat/framework`.

## Review Focus

1. **A remote's Tailwind classes are unstyled inside the host** because the remote's CSS did not load or did not include its own classes. Pinned by e2e test 1 in Task 7.
2. **Portaled content (Dialog/Select/Dropdown/Tooltip) escapes the service scope** and loses the scoped tokens, or Reka positions it wrongly inside a `display:contents` parent. Pinned by Task 3 unit tests and e2e test 2.
3. **A remote's scoped override leaks to the host**, for example the host header button turns green. Pinned by e2e test 4.
4. **Dark mode toggles but ui components keep light colours** (the dark variant or the token mapping is broken). Pinned by Task 2 CSS test and e2e test 3.
5. **An ejected component that imports a sibling breaks** (Dialog imports Button), or eject silently overwrites user edits. Pinned by Task 5 tests.

---

### Task 1: mf-core — tokens, scope wrapper, portal injection

**Files:**
- Modify: `packages/mf-core/src/theme/theme.ts` (`DEFAULT_TOKENS`)
- Create: `packages/mf-core/src/app/portal.ts`
- Modify: `packages/mf-core/src/remotes/RemoteBoundary.vue` (new `scope?: string` prop; template wrapper; provide)
- Modify: `packages/mf-core/src/remotes/loader.ts` (`defineRemoteComponent` passes `scope: id.split('/')[0]`; `errorView` passes `scope: entry.name`)
- Modify: `packages/mf-core/src/index.ts` (exports)
- Test: `packages/mf-core/test/theme.test.ts`, `packages/mf-core/test/boundary.test.ts`, `packages/mf-core/test/portal.test.ts`

**Interfaces:**
- Produces:
  - `export const MF_PORTAL_KEY: InjectionKey<Ref<HTMLElement | null>>`, with the value `Symbol.for('nineh-fe-base/ui-portal')`.
  - `export function useMfPortalTarget(): Ref<HTMLElement | string>`. It returns the injected element once mounted, otherwise `'body'`.
  - `RemoteBoundary` prop `scope?: string`, defaulting to `name`.

- [ ] **Step 1: Write the failing tests.**
  - `theme.test.ts` → `it('DEFAULT_TOKENS has every shadcn key in both modes')`. Assert that all 25 keys from Global Constraints exist in `light` and `dark`, and that each alias pair is equal per mode.
  - `boundary.test.ts`:
    - `it('wraps content in data-mf-remote scope with a trailing portal container')`. Mount `RemoteBoundary` with `name: 'products'` and a slot. Expect the root element to be a `div[data-mf-remote="products"]` with `style.display === 'contents'`, and its last child to be `[data-mf-portal]`.
    - `it('scope prop overrides the attribute')`: `name: 'products/Widget', scope: 'products'` gives the attribute `products`.
    - `it('error frame renders inside the scope')`.
  - `portal.test.ts`:
    - `it('useMfPortalTarget returns body without a boundary')`.
    - `it('useMfPortalTarget returns the boundary portal element after mount')`.
    - `it('MF_PORTAL_KEY is Symbol.for(nineh-fe-base/ui-portal)')`.
- [ ] **Step 2: Run** `npx vitest run --project mf-core`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - New token values: pick shadcn "neutral"-style values that harmonise with the existing blue primary, for both light and dark.
  - Boundary: wrap the existing `v-if`/`Suspense` in the scope div, add the `ref` portal div as the last child, and `provide(MF_PORTAL_KEY, portalRef)`.
  - Existing boundary tests that query the root element may need their selectors updated. Do not weaken their assertions.
- [ ] **Step 4: Run** `npx vitest run --project mf-core` and `npm run build -w @nineh-fe-base/mf-core`. Expected: all PASS, build OK.
- [ ] **Step 5: Commit** `feat(mf-core): shadcn token set, data-mf-remote scope and portal target`.

### Task 2: `@nineh-fe-base/ui` — package, styles, non-portal components

**Files:**
- Create: `packages/ui/package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `README.md` (short; Task 8 finishes it)
- Create: `packages/ui/src/index.ts`, `src/lib/utils.ts` (`cn`)
- Create: `packages/ui/styles/host.css`, `styles/remote.css`, `styles/tokens.css` (the shared `@theme inline` + dark variant, imported by both)
- Create: `src/components/{button,badge,card,input,label,textarea,checkbox,switch,avatar,separator,skeleton}/` with `.vue` files and an `index.ts`
- Modify: root `package.json` `build:framework` → also build `@nineh-fe-base/ui` (after mf-core)
- Test: `packages/ui/test/utils.test.ts`, `test/variants.test.ts`, `test/components.test.ts`, `test/styles.test.ts`

**Interfaces:**
- Consumes: none at runtime yet. mf-core is a peer.
- Produces:
  - Package exports: `"."` (components, `cn`, `buttonVariants`, `badgeVariants`, …) and `"./styles/*"` (CSS files).
  - `export function cn(...inputs: ClassValue[]): string`.
  - Component names match shadcn-vue: `Button`, `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `Badge`, `Input`, `Label`, `Textarea`, `Checkbox`, `Switch`, `Avatar`, `AvatarImage`, `AvatarFallback`, `Separator`, `Skeleton`.

- [ ] **Step 1: Write the failing tests.**
  - `utils.test.ts`: `cn('px-2', 'px-4') === 'px-4'`, and `cn('bg-primary', false && 'x', 'rounded-full')` equals `'bg-primary rounded-full'`.
  - `variants.test.ts`:
    - `buttonVariants({ variant: 'destructive', size: 'sm' })` contains `bg-destructive` and a `h-8`/sm-size class.
    - The defaults contain `bg-primary`.
  - `components.test.ts`:
    - `<Button class="rounded-full">` renders a `button` whose class contains `rounded-full` and not the default `rounded-md`.
    - `<Button as-child>` with an `<a>` slot renders `a`.
    - `Card` renders its slot.
    - `Input` `v-model` round-trips.
  - `styles.test.ts`. Read the CSS files from disk and assert:
    - both start with `@layer theme, base, components, utilities;`;
    - `tokens.css` maps `--color-primary: var(--mf-color-primary)` and `--color-background: var(--mf-color-background)`, plus every new token key;
    - it contains the exact dark `@custom-variant` line from Global Constraints;
    - `remote.css` does not import preflight and `host.css` does;
    - both contain an `@source` for the ui dist.
- [ ] **Step 2: Run** `npx vitest run --project ui`. Expected: FAIL (the package does not exist).
- [ ] **Step 3: Implement.**
  - Adapt the component source from shadcn-vue (new-york style) to `--mf`-mapped Tailwind colour names.
  - Build with Vite lib mode, mf-core style. Externals: vue, reka-ui, `@nineh-fe-base/mf-core`, cva, clsx, tailwind-merge, lucide-vue-next, vue-sonner.
  - `@source` must resolve from a consumer's `node_modules`. Use a path relative to the CSS file, for example `@source "../dist";`.
  - Run `npm install` at the root to link the workspace.
- [ ] **Step 4: Run** `npx vitest run --project ui`, `npm run build -w @nineh-fe-base/ui` and `npm pack --dry-run -w @nineh-fe-base/ui`. Expected: PASS; the tarball has only `dist`, `styles`, `src`, `package.json` and `README.md`.
- [ ] **Step 5: Commit** `feat(ui): package scaffold, tailwind token styles, base components`.

### Task 3: ui — portal components bound to the service scope

**Files:**
- Create: `src/components/{dialog,dropdown-menu,select,tooltip,tabs,table,toast}/`
- Create: `src/lib/portal.ts` (`usePortalTo()`, which wraps mf-core's `useMfPortalTarget`)
- Test: `packages/ui/test/portal.test.ts`

**Interfaces:**
- Consumes: `MF_PORTAL_KEY` and `useMfPortalTarget` from Task 1.
- Produces:
  - shadcn-vue names: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`; `DropdownMenu*`; `Select*`; `Tooltip*` (`TooltipProvider` included); `Tabs*`; `Table*`.
  - `Toaster` and `toast` (re-exported from vue-sonner). `Toaster` mounts into the portal target.

- [ ] **Step 1: Write the failing tests.**
  - `portal.test.ts`:
    - `it('DialogContent teleports into the enclosing data-mf-portal')`. Mount a `RemoteBoundary` (from mf-core) containing an open `Dialog`. Assert that the dialog's content element is a descendant of `[data-mf-portal]` inside `[data-mf-remote]`.
    - `it('DialogContent falls back to body without a boundary')`.
    - The same in-scope assertion for an open `DropdownMenu`, `Select` and `Tooltip`.
- [ ] **Step 2: Run** `npx vitest run --project ui`. Expected: FAIL.
- [ ] **Step 3: Implement.** Every `*Portal` usage passes `:to="portalTo"` from `usePortalTo()`.
- [ ] **Step 4: Run** `npx vitest run --project ui` and the ui build. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): dialog, dropdown, select, tooltip, tabs, table, toast scoped portals`.

### Task 4: mf-vite — Tailwind plugin and ui sharing

**Files:**
- Modify: `packages/mf-vite/src/define.ts` (`baseConfig` adds `tailwindcss()` unless `opts.tailwind === false`)
- Modify: `packages/mf-vite/src/federation.ts` (`tailwind?: boolean` on `HostOptions`/`RemoteOptions`)
- Modify: `packages/mf-vite/src/shared.ts` (export `UI_PACKAGE = '@nineh-fe-base/ui'`; `buildShared(versions, extra, coreVersion, uiDeps?)`)
- Modify: `packages/mf-vite/package.json` (deps `@tailwindcss/vite`, `tailwindcss`)
- Test: `packages/mf-vite/test/define.test.ts`, `test/federation.test.ts` (or a new `shared.test.ts`)

**Interfaces:**
- Produces:
  - `buildShared(versions, extra?, coreVersion?, uiReka?: string)`. When `versions` contains `@nineh-fe-base/ui`, the shared config gains `@nineh-fe-base/ui: { singleton: true, requiredVersion }` and `reka-ui: { singleton: true, requiredVersion: uiReka }`.
  - `uiReka` is read from the installed ui `package.json` `dependencies['reka-ui']`, resolved upward the same way as `readCoreVersion`.
  - Detection covers `dependencies` and `devDependencies`. A local spec (`*`, `file:`, `workspace:`) maps to `^<ui version>`, the same as core.

- [ ] **Step 1: Write the failing tests.**
  - The tailwind plugin is present by default (find a plugin whose name starts with `@tailwindcss/vite`) and absent with `tailwind: false`.
  - With ui in `dependencies`, both `@nineh-fe-base/ui` and `reka-ui` are singletons. With ui in `devDependencies`, the same holds. Without ui, neither key exists.
  - A user override `shared: { '@nineh-fe-base/ui': { singleton: false } }` still ends with `singleton: true` for ui and reka-ui.
- [ ] **Step 2: Run** `npx vitest run --project mf-vite`. Expected: FAIL.
- [ ] **Step 3: Implement.** The forced-singleton loop also covers ui and reka-ui when present.
- [ ] **Step 4: Run** `npx vitest run --project mf-vite` and `npm run build -w @nineh-fe-base/mf-vite`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(mf-vite): tailwind by default, share ui and reka-ui as singletons`.

### Task 5: create-mf — `ui add` eject

**Files:**
- Create: `packages/create-mf/src/eject.ts`
- Modify: `packages/create-mf/src/index.ts` (route `positionals[0] === 'ui' && positionals[1] === 'add'` to eject; update `USAGE`)
- Test: `packages/create-mf/test/eject.test.ts`

**Interfaces:**
- Consumes: ui's published `src/components/<name>/` layout from Tasks 2–3.
- Produces: `export async function ejectComponents(opts: { names: string[]; cwd: string; dir?: string; force?: boolean; uiRoot?: string }): Promise<{ written: string[] }>`.
  - `uiRoot` defaults to the resolved `@nineh-fe-base/ui` package directory (walk up `node_modules` from `cwd`).
  - `dir` defaults to `src/components/ui`.

- [ ] **Step 1: Write the failing tests.** Use a temporary fake `uiRoot` with `src/components/{button,dialog}` and `src/lib/utils.ts`, where dialog imports `../button` and both import `../../lib/utils`.
  - `ejectComponents({ names: ['button'] })` writes `src/components/ui/button/*`. The `../../lib/utils` import becomes `@nineh-fe-base/ui`.
  - `names: ['dialog']` alone: the `../button` import is rewritten to `@nineh-fe-base/ui`.
  - `names: ['dialog', 'button']`: the `../button` import is kept relative.
  - When `button` already exists in the target, ejecting `dialog` keeps `../button` relative.
  - An existing target file with no `force` rejects with a message naming the file, and nothing is written. With `force: true` it overwrites.
  - An unknown name rejects with a message listing the available components.
- [ ] **Step 2: Run** `npx vitest run --project create-mf`. Expected: FAIL.
- [ ] **Step 3: Implement.** Rewrite imports with regexes on `from '…'` and `import('…')` specifiers in `.ts` and `.vue` files.
- [ ] **Step 4: Run** `npx vitest run --project create-mf` and `npm run build -w @nineh-fe-base/create-mf`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(create-mf): ui add command to eject components`.

### Task 6: create-mf templates use Tailwind + ui

**Files:**
- Modify: `packages/create-mf/src/versions.ts` (add `tailwindVersion` if needed by the template; the framework version covers ui)
- Modify: `templates/host/package.json`, `templates/remote/package.json` (dependency `@nineh-fe-base/ui: ^%%frameworkVersion%%`)
- Modify: `templates/host/src/bootstrap.ts` (or `main.ts`): `import '@nineh-fe-base/ui/styles/host.css'`. Rewrite `Layout.vue`, `pages/Login.vue` and `pages/Home.vue` with ui components and Tailwind classes; mount `<Toaster />` in Layout.
- Create: `templates/remote/src/style.css` (`@import '@nineh-fe-base/ui/styles/remote.css';` plus a commented unlayered example `[data-mf-remote="%%name%%"] { --mf-color-primary: … }`)
- Modify: `templates/remote/src/routes.ts` (`import './style.css'`); `templates/remote/src/bootstrap.ts` (import `host.css` for standalone); `pages/SamplePage.vue` (Card + Button)
- Test: `packages/create-mf/test/generate.test.ts`

- [ ] **Step 1: Write the failing tests** in `generate.test.ts`:
  - The generated host `package.json` has `@nineh-fe-base/ui`, and its bootstrap imports `@nineh-fe-base/ui/styles/host.css`.
  - The generated remote has `src/style.css` containing `remote.css` and `[data-mf-remote="<name>"]`, and `routes.ts` imports `./style.css`.
  - No `%%` remains in any generated file.
- [ ] **Step 2: Run** `npx vitest run --project create-mf`. Expected: FAIL.
- [ ] **Step 3: Implement** the template changes.
- [ ] **Step 4: Run** `npx vitest run --project create-mf`. Then smoke-test in the scratchpad: generate a host and a remote, swap their `@nineh-fe-base/*` dependencies for `file:` paths to `packages/*`, run `npm install` and `npx vite build` in each, and confirm both builds succeed. Record the commands and results in the report.
- [ ] **Step 5: Commit** `feat(create-mf): templates use tailwind and @nineh-fe-base/ui`.

### Task 7: playground on ui + e2e

**Files:**
- Modify: `playground/shell`, `playground/auth-service` and `playground/products-service` `package.json` (add `@nineh-fe-base/ui: "*"`)
- Modify: the shell `bootstrap.ts`/`main.ts` (import `host.css`); `Layout.vue` (ui Button/DropdownMenu, a dark-mode toggle button `data-test="theme-toggle"`, `<Toaster />`); `pages/*`
- Modify: auth-service `Login.vue` (Card, Input, Label, Button); add its own `src/style.css` imported from `routes.ts`
- Modify: products-service:
  - `ProductList.vue` uses Table, Badge and Button, plus a Dialog opened by `data-test="product-detail"` whose content has `data-test="product-dialog"`;
  - `products.css` → `src/style.css` with `remote.css` plus the unlayered override `[data-mf-remote="products"] { --mf-color-primary: #16a34a; }` (dark: `#4ade80`);
  - keep the existing selectors the e2e tests use (`data-test` attributes and the title), or update the tests in the same commit.
- Test: `playground/e2e/tests/ui.spec.ts`, plus `flow.spec.ts` kept green

- [ ] **Step 1: Write the failing e2e tests** in `ui.spec.ts`. Log in as admin/admin first.
  1. `products button uses scoped primary`: the computed `background-color` of the products-page primary Button is `rgb(22, 163, 74)`.
  2. `dialog keeps scoped token`: after clicking `product-detail`, the dialog's primary button computes to `rgb(22, 163, 74)`, and the dialog element is inside `[data-mf-remote="products"]`.
  3. `dark mode switches host and remote`: clicking `theme-toggle` changes the computed background of the shell header and of the products Button. Remote dark value: `rgb(74, 222, 128)`.
  4. `scoped override does not leak`: a shell header primary Button computes to the default primary (`rgb(37, 99, 235)` in light).
- [ ] **Step 2: Run** `npm run e2e`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the playground changes. Run `npm install` at the root.
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run build` and `npm run e2e`. Expected: all green, with the 9 existing and 4 new e2e tests passing.
- [ ] **Step 5: Commit** `feat(playground): use @nineh-fe-base/ui with scoped products theme; ui e2e`.

### Task 8: Docs and changeset

**Files:**
- Modify: root `README.md` (Vietnamese), adding a "Tailwind & UI" section:
  - the CSS entries (`host.css`/`remote.css`) and where to import them;
  - the 4 customisation layers with examples;
  - the layer order;
  - the note that unlayered custom CSS beats utilities (wrap it in `@layer components`);
  - `ui add`;
  - `tailwind: false`.
- Create/finish: `packages/ui/README.md`.
- Modify: `packages/mf-vite/README.md` (`tailwind` option, ui sharing), `packages/mf-core/README.md` (tokens, `MF_PORTAL_KEY`, `useMfPortalTarget`, scope element), `packages/create-mf/README.md` (`ui add`).
- Create: `.changeset/ui-tailwind.md` (minor for the 4 packages).

- [ ] **Step 1: Write the docs.** Every code sample must match the real exports, so check them against `src/index.ts`.
- [ ] **Step 2: Run** `npm run lint` and `npx vitest run`. Expected: green.
- [ ] **Step 3: Commit** `docs: tailwind and ui usage, customisation layers`.
