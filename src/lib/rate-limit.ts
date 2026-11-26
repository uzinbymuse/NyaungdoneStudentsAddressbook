// Simple in-memory sliding-window rate limiter for API routes (login, search, register).
// Note: In multi-instance serverless, pair with Upstash/Redis if traffic scales beyond 2,000 users.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  if (buckets.size > 500) {
    for (const [k, b] of buckets.entries()) {
      if (now > b.resetAt) buckets.delete(k);
    }
  }
  const existing = buckets.get(key);

  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - existing.count,
    retryAfterSeconds: 0,
  };
}
