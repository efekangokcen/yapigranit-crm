/**
 * In-Memory Rate Limiter (Giriş ve API İstek Sınırlayıcı)
 *
 * Şüpheli brute-force ve aşırı istek saldırılarını engeller.
 */

interface RateLimitRecord {
  count: number
  firstRequestTime: number
}

const store = new Map<string, RateLimitRecord>()

// Her 5 dakikada bir süresi dolan kayıtları temizle
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of store.entries()) {
    if (now - record.firstRequestTime > 10 * 60 * 1000) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

export function checkRateLimit(
  key: string,
  maxRequests = 5,
  windowMs = 60 * 1000
): RateLimitResult {
  const now = Date.now()
  const record = store.get(key)

  if (!record) {
    store.set(key, { count: 1, firstRequestTime: now })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetInSeconds: Math.ceil(windowMs / 1000),
    }
  }

  // Pencere süresi dolmuşsa sıfırla
  if (now - record.firstRequestTime > windowMs) {
    store.set(key, { count: 1, firstRequestTime: now })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetInSeconds: Math.ceil(windowMs / 1000),
    }
  }

  // Pencere süresi içinde
  if (record.count >= maxRequests) {
    const resetInSeconds = Math.ceil((record.firstRequestTime + windowMs - now) / 1000)
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds,
    }
  }

  record.count += 1
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetInSeconds: Math.ceil((record.firstRequestTime + windowMs - now) / 1000),
  }
}
