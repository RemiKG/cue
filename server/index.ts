// index.ts (server) — the Node entrypoint. It mounts the shared /api Hono app
// (server/app.ts) AND serves the built client from a single process. In dev, Vite serves
// the client and proxies /api here. On Vercel, api/[[...route]].ts reuses the same app.
// The client only ever calls relative "/api/*", so there are no hardcoded hosts.
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { app } from './app';
import { hasKey, BASE_URL } from './qwen';

const PORT = Number(process.env.PORT || 8787);

// ── static (production) ──────────────────────────────────────────────────────
const DIST = resolve(process.cwd(), 'dist');
if (existsSync(DIST)) {
  app.use('/*', serveStatic({ root: './dist' }));
  const indexHtml = existsSync(resolve(DIST, 'index.html')) ? readFileSync(resolve(DIST, 'index.html'), 'utf8') : '';
  // SPA fallback for any non-API, non-file route
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api')) return c.notFound();
    return c.html(indexHtml);
  });
} else {
  app.get('/', (c) => c.text('Cue API is running. In dev, open the Vite client on :5173. Build the client (npm run build) to serve it here.'));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Cue server on http://localhost:${info.port}  ·  cloud=${hasKey() ? 'connected' : 'no key (on-device fallback)'}  ·  ${BASE_URL}`);
});
