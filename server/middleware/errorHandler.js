/**
 * FIX #17: centralized, consistent global error handler
 * FIX #29: consistent error response format across all APIs
 * FIX #40: generic server errors not exposed to client
 */
const errorHandler = (err, req, res, next) => {
  // Log all errors server-side
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${new Date().toISOString()}] ERROR:`, err);
  } else {
    // FIX #37: audit log for auth errors in production
    if (req.path.startsWith('/api/auth')) {
      console.error(`[${new Date().toISOString()}] AUTH_ERROR path=${req.path} ip=${req.ip} msg=${err.message}`);
    }
  }

  let statusCode = err.statusCode || 500;
  // FIX #40: never expose raw server error messages to clients
  let message = 'Something went wrong. Please try again.';

  // FIX #5: Mongoose duplicate key (E11000) error — handled properly
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already in use.`;
  }

  // Mongoose validation error
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    const msgs = Object.values(err.errors).map((e) => e.message);
    message = msgs[0] || 'Validation failed.';
  }

  // FIX #39: Mongoose CastError for malformed ObjectIds
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format.';
  }

  // Known application errors (thrown explicitly with statusCode + message)
  else if (err.statusCode && err.message) {
    message = err.message;
  }

  // JWT errors (should be caught in middleware, but as fallback)
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired. Please log in again.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    // FIX #29: consistent shape — only add stack in dev
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// FIX #30: global unhandled promise rejection safety net
const setupProcessHandlers = () => {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[UnhandledRejection]', reason);
    // In production you may want to gracefully shut down here
  });

  process.on('uncaughtException', (err) => {
    console.error('[UncaughtException]', err);
    process.exit(1);
  });
};

module.exports = { errorHandler, setupProcessHandlers };
