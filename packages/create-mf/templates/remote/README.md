# %%name%%

Remote micro-frontend built on `@nineh2303/mf-core` and `@nineh2303/mf-vite`.

```bash
npm install
npm run dev        # standalone at http://localhost:%%port%%/
npm run typecheck
npm run build
```

Routes are exposed as `./routes` (see `vite.config.ts`). To plug it into a host, add this entry to the host's `public/remotes.json`:

```json
{ "name": "%%name%%", "entry": "http://localhost:%%port%%/mf-manifest.json", "routePrefix": "/%%name%%", "menu": { "label": "%%name%%" } }
```

## Standalone auth

`npm run dev` runs the remote alone with a mock auth adapter that logs in automatically. Standalone mode has no `/auth/login` page (in a real deployment it comes from the host / auth remote). To run standalone against a real backend with `jwtAdapter({ baseURL })`, also add a login route to the remote's routes and pass `loginPath` to `createStandaloneRemote`, otherwise protected pages redirect to a missing `/auth/login`.

## Tailwind and UI

Tailwind v4 is enabled by `@nineh2303/mf-vite`; components come from `@nineh2303/ui`. `src/style.css` (imported by `src/routes.ts`) pulls in `remote.css` and holds a commented example of a scoped theme: override `--mf-*` tokens under `[data-mf-remote="%%name%%"]` to restyle only this remote, including its dialogs and dropdowns. Standalone mode (`src/bootstrap.ts`) also imports `host.css` for the preflight. Eject a component to own its source with `npx @nineh2303/create-mf ui add <component>`.
