/**
 * Central Error Handler Middleware
 * Guarantees uniform JSON structure: { error: message }
 */
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error('[Error caught by errorHandler]:', err);

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({ error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const firstKey = Object.keys(err.errors)[0];
    return res.status(400).json({ error: err.errors[firstKey].message });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Custom status code or default 500
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  return res.status(status).json({ error: message });
}

module.exports = errorHandler;
