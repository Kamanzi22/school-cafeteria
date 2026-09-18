import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger } from 'hono/logger';
import { getPrisma } from './lib/prisma.js';

// Comma-separated list, e.g. "https://cafecampus-client.onrender.com". An empty/unset
// CLIENT_URL denies all cross-origin requests instead of falling back to a wildcard default —
// mirrors server/src/index.js's corsOrigin logic exactly.
const allowedOrigins = (env) => (env.CLIENT_URL || '').split(',').map((s) => s.trim()).filter(Boolean);

const app = new Hono();

app.use('*', async (c, next) => {
  if (c.env.ENVIRONMENT === 'development') return logger()(c, next);
  return next();
});

app.use('*', secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }));

app.use('*', async (c, next) => {
  const mw = cors({
    origin: (origin) => (!origin || allowedOrigins(c.env).includes(origin) ? origin : undefined),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  return mw(c, next);
});

// Attaches a per-isolate-cached Prisma client (via Hyperdrive) to the request context so every
// route reads `c.get('prisma')` instead of importing a module-scope singleton — see lib/prisma.js
// for why the singleton pattern from server/src/lib/prisma.js can't survive the port as-is.
app.use('*', async (c, next) => {
  c.set('prisma', getPrisma(c.env));
  await next();
});

// Stage 1 verification route — ported from server/src/index.js:45, runs a real query so it
// also proves the Hyperdrive/Prisma connection path works end-to-end, not just that the
// Worker boots.
app.get('/api/health', async (c) => {
  const prisma = c.get('prisma');
  await prisma.$queryRaw`SELECT 1`;
  return c.json({ ok: true, ts: Date.now() });
});

app.onError((err, c) => {
  console.error(err.stack);
  return c.json({ success: false, error: err.message || 'Server error' }, err.status || 500);
});

export default app;
