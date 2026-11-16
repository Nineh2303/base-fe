# {{name}}

Remote micro-frontend built on `@nineh-fe-base/mf-core` and `@nineh-fe-base/mf-vite`.

```bash
npm install
npm run dev        # standalone at http://localhost:{{port}}/
npm run typecheck
npm run build
```

Routes are exposed as `./routes` (see `vite.config.ts`). To plug it into a host, add this entry to the host's `public/remotes.json`:

```json
{ "name": "{{name}}", "entry": "http://localhost:{{port}}/mf-manifest.json", "routePrefix": "/{{name}}", "menu": { "label": "{{name}}" } }
```
