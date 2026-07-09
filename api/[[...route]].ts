// Vercel serverless entry for /api/* — reuses the exact same Hono app the Node server
// mounts (server/app.ts), so localhost and the Vercel deployment behave identically.
// Without DASHSCOPE_API_KEY every route returns 503 no-key and the client runs on-device.
import { handle } from 'hono/vercel';
import { app } from '../server/app';

export const config = { runtime: 'nodejs' };

export default handle(app);
