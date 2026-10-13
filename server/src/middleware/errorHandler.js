/**
 * Central Error Handler Middleware
 * Guarantees uniform JSON structure: { error: message }
 */
function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;
  if (status >= 500 && process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error('[Error caught by errorHandler]:', err);
  }

  // Malformed ObjectId in a URL or body (e.g. /api/events/not-an-id)
  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Invalid ${err.path || 'id'}` });
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }

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

  // Never leak internal error details from a 500
  const message = status >= 500 ? 'Internal server error' : err.message || 'Request failed';

  return res.status(status).json({ error: message });
}

module.exports = errorHandler;
