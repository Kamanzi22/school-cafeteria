require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL, methods: ['GET','POST','PUT','PATCH','DELETE'], credentials: true }
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.set('io', io);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/upload', require('./routes/upload'));

app.get('/api/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Server error' });
});

require('./socket/handlers')(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`\n🚀 CaféCampus v3 running on http://localhost:${PORT}\n`));
