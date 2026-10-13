require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { connectDB } = require('./utils/db');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const { setupSeatSockets } = require('./sockets/seatSocket');
const { startSeatExpiryJob } = require('./jobs/seatExpiryJob');

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Attach Socket.IO instance to app for controllers/services access
app.set('io', io);

// Setup room handlers
setupSeatSockets(io);

/**
 * SEED_ON_START=true  -> seed demo data on first boot only (never wipes an existing database).
 * DEMO_MODE=true      -> public live demo: also wipe and reseed if the data is more than
 *                        DEMO_RESET_HOURS old (default 24), so a messed-up demo heals itself.
 *                        On a free host that sleeps when idle, this runs on the next wake-up.
 */
async function prepareDemoData() {
  const seedOnStart = process.env.SEED_ON_START === 'true';
  const demoMode = process.env.DEMO_MODE === 'true';
  if (!seedOnStart && !demoMode) return;

  // eslint-disable-next-line global-require
  const User = require('./models/User');
  // eslint-disable-next-line global-require
  const { seedUsers } = require('./utils/seed');

  const admin = await User.findOne({ email: 'admin@ticketx.com' });
  if (!admin) {
    await seedUsers();
    return;
  }

  if (demoMode) {
    const resetMs = Number(process.env.DEMO_RESET_HOURS || 24) * 60 * 60 * 1000;
    const ageMs = Date.now() - new Date(admin.createdAt).getTime();
    if (ageMs > resetMs) {
      // eslint-disable-next-line no-console
      console.log(`[Demo] Data is ${Math.round(ageMs / 3600000)}h old, resetting demo data`);
      await seedUsers();
    }
  }
}

async function startServer() {
  try {
    await connectDB();

    await prepareDemoData();

    server.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`[TicketX Server] Running on http://localhost:${PORT}`);
      startSeatExpiryJob(io);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { server, io };
