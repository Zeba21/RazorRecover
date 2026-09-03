/**
 * Global error handler middleware for Express.
 * Catches all unhandled errors and returns structured JSON responses.
 * Enforces safety: stack traces and secrets are NEVER returned to clients.
 */
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Sanitize internal database/system errors from leaking credentials or internal details
  if (message.includes('postgresql://') || message.includes('SUPABASE_') || message.includes('password=')) {
    message = 'Database operation failed. Details suppressed for security.';
  }

  console.error(`❌ [${req.method}] ${req.path} — ${statusCode}: ${err.message}`);

  res.status(statusCode).json({
    success: false,
    error: {
      message
    }
  });
}

/**
 * 404 handler for unknown routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.path}`
    }
  });
}

module.exports = { errorHandler, notFoundHandler };

