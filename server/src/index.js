require('dotenv').config();
// Every "today", date filter and hour label (dashboard, sales report, order/visit/delivery
// history) is worked out in the server's local time — Kigali's, not the host's UTC. Prisma still
// stores and compares timestamps in UTC, so only the day/hour boundaries move.
process.env.TZ = 'Africa/Kigali';
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { clientIpKey } = require('./lib/clientIp');

// Comma-separated list, e.g. "https://cafecampus-client.onrender.com". An empty/unset
// CLIENT_URL denies all cross-origin requests instead of falling back to the cors package's
// wildcard default for a falsy origin.
const allowedOrigins = (process.env.CLIENT_URL || '').split(',').map(s => s.trim()).filter(Boolean);
const corsOrigin = (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin));

const app = express();
app.set('trust proxy', 1);
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: corsOrigin, methods: ['GET','POST','PUT','PATCH','DELETE'], credentials: true }
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// maxAge lets the browser remember the CORS preflight (the OPTIONS check sent before every request
// that carries a login token or a JSON body) for 2 hours, Chrome's cap. Without it Chrome only
// remembers it for 5 seconds, so nearly every signed-in request cost two round trips to the
// server instead of one — about half a second each from Rwanda.
app.use(cors({ origin: corsOrigin, credentials: true, maxAge: 7200 }));
app.use(express.json({ limit: '10mb' }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));
// Everywhere else, one log line per failed request (5xx) — most routes answer an error with a
// 500 and its message without logging anything, so the Render logs never showed what broke.
// The query string is left out (it can hold what people searched for).
else app.use((req, res, next) => {
  const started = Date.now();
  const json = res.json.bind(res);
  res.json = (body) => { if (res.statusCode >= 500) res.locals.failure = body?.error; return json(body); };
  res.on('finish', () => {
    if (res.statusCode < 500) return;
    // Database errors run to many lines and can quote the values queried — keep one short line
    const why = res.locals.failure ? `: ${String(res.locals.failure).replace(/\s+/g, ' ').trim().slice(0, 300)}` : '';
    console.error(`${req.method} ${req.originalUrl.split('?')[0]} → ${res.statusCode} in ${Date.now() - started}ms${why}`);
  });
  next();
});
// Overridable via RATE_LIMIT_MAX so a staging env can be raised for load testing
// (see load-tests/rush-hour.js) without changing the production default.
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: parseInt(process.env.RATE_LIMIT_MAX) || 1000, keyGenerator: clientIpKey }));
app.set('io', io);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/push', require('./routes/push'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/upload', require('./routes/upload'));

app.get('/api/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Server error' });
});

require('./socket/handlers')(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`\n🚀 CaféCampus v3 running on http://localhost:${PORT}\n`));
