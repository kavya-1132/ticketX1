const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const testRolesRoutes = require('./routes/testRoles');
const venueRoutes = require('./routes/venues');
const eventRoutes = require('./routes/events');
const seatRoutes = require('./routes/seats');
const bookingRoutes = require('./routes/bookings');
const waitlistRoutes = require('./routes/waitlist');
const ticketRoutes = require('./routes/tickets');
const organiserRoutes = require('./routes/organiser');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';

// Behind Docker / a reverse proxy, use the real client IP for rate limiting
app.set('trust proxy', 1);

// Basic security headers (kept dependency-free)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Rate limits (off in tests, where the race test deliberately fires bursts from one IP)
const limiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: message },
});

// Slow down password guessing
app.use('/api/auth/login', limiter(15 * 60 * 1000, 20, 'Too many login attempts, try again in 15 minutes'));
app.use('/api/auth/register', limiter(60 * 60 * 1000, 10, 'Too many accounts created, try again later'));
// Stop one client from hammering seat holds / bookings
app.use('/api/seats', limiter(60 * 1000, 60, 'Too many seat requests, slow down'));
app.use('/api/bookings', limiter(60 * 1000, 30, 'Too many booking requests, slow down'));
app.use('/api', limiter(60 * 1000, 300, 'Too many requests'));

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'ticketx-server' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
if (!isProduction) {
  // Role-check demo endpoints used by the auth tests; not exposed in production
  app.use('/api/test', testRolesRoutes);
}
app.use('/api/venues', venueRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/organiser', organiserRoutes);

// Single-service deployment: serve the built React app (client/dist) from the same origin,
// so the live demo is one URL with no CORS and Socket.IO on the same host.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (!isTest && fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  // Any non-API GET goes to the React router
  app.get(/^\/(?!api\/|socket\.io\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// 404 Route handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Central Error Handler
app.use(errorHandler);

module.exports = app;
