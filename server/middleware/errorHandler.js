/**
 * Centralized error handler middleware.
 * Must be registered AFTER all routes in server.js.
 */
const errorHandler = (err, req, res, next) => {
  // Log error details (but never log passwords or tokens)
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.error('Error:', err.message);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join('. ') });
  }

  // Mongoose duplicate key error (e.g., duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `An account with this ${field} already exists.`,
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID format.' });
  }

  // Default: internal server error
  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : 'Something went wrong. Please try again.';

  res.status(statusCode).json({ success: false, message });
};

module.exports = errorHandler;
