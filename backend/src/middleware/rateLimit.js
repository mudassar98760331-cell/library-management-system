// Simple in-memory rate limiter for auth endpoints.
// In production, use redis-based rate limiting (e.g., express-rate-limit with redis store).

const attempts = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of attempts) {
    if (now - data.windowStart > 15 * 60 * 1000) {
      attempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiter middleware factory.
 * @param {object} opts
 * @param {number} opts.max - Max attempts per window (default: 5)
 * @param {number} opts.windowMs - Window duration in ms (default: 15 min)
 */
export function rateLimit({ max = 5, windowMs = 15 * 60 * 1000 } = {}) {
  return (req, res, next) => {
    const key = req.ip + ":" + req.path;
    const now = Date.now();
    const record = attempts.get(key);

    if (!record || now - record.windowStart > windowMs) {
      attempts.set(key, { count: 1, windowStart: now });
      return next();
    }

    record.count++;
    if (record.count > max) {
      const retryAfter = Math.ceil((record.windowStart + windowMs - now) / 1000);
      return res.status(429).json({
        error: `Too many attempts. Try again in ${retryAfter} seconds.`,
      });
    }

    next();
  };
}
