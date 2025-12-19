import { createMiddleware } from 'hono/factory'
import { isDevelopment } from '../lib/startup'

/**
 * Security headers middleware.
 * Implements OWASP-recommended security headers.
 */

/**
 * Security headers for all routes.
 */
export const securityHeaders = () => {
  return createMiddleware(async (c, next) => {
    await next()

    // Prevent content-type sniffing
    c.res.headers.set('X-Content-Type-Options', 'nosniff')

    // Prevent clickjacking
    c.res.headers.set('X-Frame-Options', 'DENY')

    // XSS protection (legacy browsers)
    c.res.headers.set('X-XSS-Protection', '1; mode=block')

    // Referrer policy
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    // HSTS (skip in development since no HTTPS)
    if (!isDevelopment()) {
      c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
  })
}

/**
 * Strict security headers for auth routes.
 * Adds cache control to prevent token caching.
 */
export const authSecurityHeaders = () => {
  return createMiddleware(async (c, next) => {
    await next()

    // Apply base security headers
    c.res.headers.set('X-Content-Type-Options', 'nosniff')
    c.res.headers.set('X-Frame-Options', 'DENY')
    c.res.headers.set('X-XSS-Protection', '1; mode=block')
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    // HSTS (skip in development since no HTTPS)
    if (!isDevelopment()) {
      c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }

    // Prevent caching of auth responses (OWASP requirement)
    c.res.headers.set('Cache-Control', 'no-store')
    c.res.headers.set('Pragma', 'no-cache')
  })
}

/**
 * Content Security Policy for API routes.
 * Restricts resource loading to same origin.
 */
export const apiCSP = () => {
  return createMiddleware(async (c, next) => {
    await next()

    c.res.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  })
}

/**
 * CORS preflight headers.
 * Ensures security headers are sent for OPTIONS requests too.
 */
export const secureOptions = () => {
  return createMiddleware(async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      c.res.headers.set('X-Content-Type-Options', 'nosniff')
      c.res.headers.set('X-Frame-Options', 'DENY')
    }
    await next()
  })
}
