import { timingSafeEqual } from "node:crypto";

/**
 * timingSafeCompare
 * Compares two strings in a way that prevents timing attacks.
 */
export function timingSafeCompare(userInput, secretKey) {
  if (!userInput || !secretKey) return false;
  
  const userBuf = Buffer.from(userInput);
  const secretBuf = Buffer.from(secretKey);

  if (userBuf.length !== secretBuf.length) {
    // We still do a dummy comparison to help mask the source of the timing difference
    timingSafeEqual(secretBuf, secretBuf);
    return false;
  }

  return timingSafeEqual(userBuf, secretBuf);
}

/**
 * Simple In-Memory Rate Limiter Middleware Factory
 */
const rateLimitMap = new Map();

export const rateLimiter = (options) => {
  const { windowMs, max, message } = options;
  
  return async (c, next) => {
    const ip = c.req.header("x-forwarded-for") || "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    let userData = rateLimitMap.get(ip) || { requests: [], lastReset: now };

    // Clean up old requests outside the window
    userData.requests = userData.requests.filter(timestamp => timestamp > windowStart);

    if (userData.requests.length >= max) {
      return c.json({ error: message || "Too many requests" }, 429);
    }

    userData.requests.push(now);
    rateLimitMap.set(ip, userData);

    await next();
  };
};
