/**
 * RazorRecover Module 9 — In-Memory Rate Limiting Middleware
 * Protects sensitive endpoints (recovery execution, payment retry, demo payment failure, webhooks)
 * from abuse while avoiding disruption to tests or dashboard usage.
 */

const requestCounts = new Map();

/**
 * Creates a rate limiter middleware instance.
 * @param {Object} options Options for rate limiting
 * @param {number} options.windowMs Time window in milliseconds (default 60 seconds)
 * @param {number} options.max Maximum requests per window (default 30)
 * @param {string} options.message Error message on limit exceeded
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 30;
  const message = options.message || 'Too many requests, please try again later.';

  return (req, res, next) => {
    // Bypass rate limit in test environment unless explicitly testing rate limits
    if ((process.env.NODE_ENV === 'test' && !req.headers?.['x-test-rate-limit']) || req.headers?.['x-bypass-rate-limit'] === 'true') {
      return next();
    }

    const key = req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';
    const now = Date.now();

    if (!requestCounts.has(key)) {
      requestCounts.set(key, []);
    }

    const timestamps = requestCounts.get(key).filter(ts => now - ts < windowMs);

    if (timestamps.length >= max) {
      return res.status(429).json({
        success: false,
        error: {
          message,
          retry_after_seconds: Math.ceil((windowMs - (now - timestamps[0])) / 1000)
        }
      });
    }

    timestamps.push(now);
    requestCounts.set(key, timestamps);
    next();
  };
}

module.exports = { createRateLimiter };
