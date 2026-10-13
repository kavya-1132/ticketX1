const mongoose = require('mongoose');

/**
 * Connect to MongoDB instance
 */
async function connectDB(uri) {
  // Tolerate copy-paste mistakes in hosting dashboards: spaces, quotes, or a "MONGO_URI=" prefix
  const raw = uri || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ticketx?replicaSet=rs0';
  const mongoUri = String(raw).trim().replace(/^MONGO_URI\s*=\s*/i, '').replace(/^['"]|['"]$/g, '').trim();
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    throw new Error(
      `MONGO_URI must start with mongodb:// or mongodb+srv:// (got: "${mongoUri.slice(0, 12)}...", length ${mongoUri.length})`
    );
  }
  try {
    const conn = await mongoose.connect(mongoUri);
    // eslint-disable-next-line no-console
    console.log(`[MongoDB Connected]: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[MongoDB Connection Error]:', error.message);
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = {
  connectDB,
  disconnectDB,
};
