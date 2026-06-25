import CircuitBreaker from 'opossum'

const defaultOptions = {
  timeout:             5000,  // 5s max per call
  errorThresholdPercentage: 50,
  resetTimeout:        30000, // 30s before retrying after open
  volumeThreshold:     3,     // min calls before opening
}

function makeBreaker(fn, name, options = {}) {
  const breaker = new CircuitBreaker(fn, { ...defaultOptions, ...options, name })
  breaker.on('open',     () => console.warn(`[CB] ${name}: circuit OPEN — fast-failing`))
  breaker.on('halfOpen', () => console.info(`[CB] ${name}: circuit HALF-OPEN — probing`))
  breaker.on('close',    () => console.info(`[CB] ${name}: circuit CLOSED — recovered`))
  return breaker
}

async function withRetry(fn, maxAttempts = 3) {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 200 * 2 ** (attempt - 1)))
      }
    }
  }
  throw lastErr
}

export { makeBreaker, withRetry }
