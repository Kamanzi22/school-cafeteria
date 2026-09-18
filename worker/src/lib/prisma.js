import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// env.HYPERDRIVE is only reachable inside a request's fetch handler, not at module-import
// time, so this can't be a bare top-level singleton the way server/src/lib/prisma.js is.
// Cached per isolate instead — an isolate handles many requests, so this still avoids
// reconnecting on every request while staying valid across Workers' execution model.
let cached;

export function getPrisma(env) {
  if (!cached) {
    const adapter = new PrismaPg({ connectionString: env.HYPERDRIVE.connectionString });
    cached = new PrismaClient({ adapter });
  }
  return cached;
}
