# %%name%%

Remote micro-frontend built on `@nineh-fe-base/mf-core` and `@nineh-fe-base/mf-vite`.

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
