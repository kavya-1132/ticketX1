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

async function startServer() {
  try {
    await connectDB();

    // Docker convenience: seed demo data on first boot only (never wipes an existing database)
    if (process.env.SEED_ON_START === 'true') {
      // eslint-disable-next-line global-require
      const User = require('./models/User');
      if ((await User.estimatedDocumentCount()) === 0) {
        // eslint-disable-next-line global-require
        const { seedUsers } = require('./utils/seed');
        await seedUsers();
      }
    }

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
