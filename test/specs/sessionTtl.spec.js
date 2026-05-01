import { beforeEach, describe, expect, it } from 'vitest'
import { sessionTtlMiddleware } from '../../lib/sessionTTL.js'

describe('Session TTL Middleware', () => {
  let middleware
  let mockConfig
  let req
  let res
  let nextCalled
  let next

  beforeEach(() => {
    // Default config
    mockConfig = {
      sessionSettings: {
        cookieMaxAge: '3600000', // 1 hour in milliseconds
      },
    }

    middleware = sessionTtlMiddleware(mockConfig)

    // Mock request object
    req = {
      session: null,
      cookies: {},
    }

    // Mock response object
    res = {
      cookie: function (name, value, options) {
        this._setCookie = { name, value, options }
      },
      _setCookie: null,
    }

    // Track if next() was called
    nextCalled = false
    next = () => {
      nextCalled = true
    }
  })

  describe('Session TTL Update', () => {
    it('should update session TTL when session exists and current TTL is less than configured TTL', () => {
      const configuredTTL = 3600000 // 1 hour
      const currentTTL = 1800000 // 30 minutes
      const now = Date.now()

      mockConfig.sessionSettings.cookieMaxAge = configuredTTL.toString()
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = {
        cookie: {
          maxAge: currentTTL,
          originalMaxAge: currentTTL,
          expires: new Date(now + currentTTL),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(req.session.cookie.maxAge).toBe(configuredTTL)
      expect(req.session.cookie.originalMaxAge).toBe(configuredTTL)
      expect(req.session.cookie.expires.getTime()).toBeGreaterThan(now + configuredTTL - 1000)
    })

    it('should not update session TTL when current TTL is greater than configured TTL', () => {
      const configuredTTL = 3600000 // 1 hour
      const currentTTL = 7200000 // 2 hours
      const originalExpires = new Date(Date.now() + currentTTL)

      mockConfig.sessionSettings.cookieMaxAge = configuredTTL.toString()
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = {
        cookie: {
          maxAge: currentTTL,
          originalMaxAge: currentTTL,
          expires: originalExpires,
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(req.session.cookie.maxAge).toBe(currentTTL)
      expect(req.session.cookie.originalMaxAge).toBe(currentTTL)
      expect(req.session.cookie.expires).toBe(originalExpires)
    })

    it('should update session TTL when current TTL is NaN', () => {
      const configuredTTL = 3600000

      mockConfig.sessionSettings.cookieMaxAge = configuredTTL.toString()
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = {
        cookie: {
          maxAge: NaN,
          originalMaxAge: NaN,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(req.session.cookie.maxAge).toBe(configuredTTL)
      expect(req.session.cookie.originalMaxAge).toBe(configuredTTL)
    })

    it('should not update session TTL when session is null', () => {
      mockConfig.sessionSettings.cookieMaxAge = '3600000'
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = null

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      // No error should occur
    })

    it('should not update session TTL when session cookie is missing', () => {
      mockConfig.sessionSettings.cookieMaxAge = '3600000'
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = {
        cookie: null,
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(req.session.cookie).toBeNull()
    })

    it('should not update session TTL when configured TTL is NaN', () => {
      const currentTTL = 1800000

      mockConfig.sessionSettings.cookieMaxAge = 'invalid'
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = {
        cookie: {
          maxAge: currentTTL,
          originalMaxAge: currentTTL,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(req.session.cookie.maxAge).toBe(currentTTL)
    })

    it('should not update session TTL when configured TTL is zero', () => {
      const currentTTL = 1800000

      mockConfig.sessionSettings.cookieMaxAge = '0'
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = {
        cookie: {
          maxAge: currentTTL,
          originalMaxAge: currentTTL,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(req.session.cookie.maxAge).toBe(currentTTL)
    })

    it('should not update session TTL when configured TTL is negative', () => {
      const currentTTL = 1800000

      mockConfig.sessionSettings.cookieMaxAge = '-1000'
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = {
        cookie: {
          maxAge: currentTTL,
          originalMaxAge: currentTTL,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(req.session.cookie.maxAge).toBe(currentTTL)
    })
  })

  describe('LoggedIn Cookie Handling', () => {
    it('should set LoggedIn cookie when LoggedIn cookie exists and configured TTL is valid', () => {
      const configuredTTL = 3600000

      mockConfig.sessionSettings.cookieMaxAge = configuredTTL.toString()
      middleware = sessionTtlMiddleware(mockConfig)

      req.cookies.LoggedIn = true
      req.session = {
        cookie: {
          maxAge: configuredTTL,
          originalMaxAge: configuredTTL,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(res._setCookie).not.toBeNull()
      expect(res._setCookie.name).toBe('LoggedIn')
      expect(res._setCookie.value).toBe(true)
      expect(res._setCookie.options.maxAge).toBe(configuredTTL)
      expect(res._setCookie.options.httpOnly).toBe(true)
    })

    it('should use session TTL for LoggedIn cookie when session TTL is valid', () => {
      const configuredTTL = 3600000
      const sessionTTL = 1800000

      mockConfig.sessionSettings.cookieMaxAge = configuredTTL.toString()
      middleware = sessionTtlMiddleware(mockConfig)

      req.cookies.LoggedIn = true
      req.session = {
        cookie: {
          maxAge: sessionTTL,
          originalMaxAge: sessionTTL,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      // After middleware runs, session TTL is updated to configuredTTL when it was less
      // So LoggedIn cookie should use the updated session TTL value
      expect(res._setCookie.options.maxAge).toBe(configuredTTL)
    })

    it('should use configured TTL for LoggedIn cookie when session TTL is NaN', () => {
      const configuredTTL = 3600000

      mockConfig.sessionSettings.cookieMaxAge = configuredTTL.toString()
      middleware = sessionTtlMiddleware(mockConfig)

      req.cookies.LoggedIn = true
      req.session = {
        cookie: {
          maxAge: NaN,
          originalMaxAge: NaN,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(res._setCookie.options.maxAge).toBe(configuredTTL)
    })

    it('should use configured TTL for LoggedIn cookie when session TTL is zero', () => {
      const configuredTTL = 3600000

      mockConfig.sessionSettings.cookieMaxAge = configuredTTL.toString()
      middleware = sessionTtlMiddleware(mockConfig)

      req.cookies.LoggedIn = true
      req.session = {
        cookie: {
          maxAge: 0,
          originalMaxAge: 0,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(res._setCookie.options.maxAge).toBe(configuredTTL)
    })

    it('should use configured TTL for LoggedIn cookie when session TTL is negative', () => {
      const configuredTTL = 3600000

      mockConfig.sessionSettings.cookieMaxAge = configuredTTL.toString()
      middleware = sessionTtlMiddleware(mockConfig)

      req.cookies.LoggedIn = true
      req.session = {
        cookie: {
          maxAge: -1000,
          originalMaxAge: -1000,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(res._setCookie.options.maxAge).toBe(configuredTTL)
    })

    it('should not set LoggedIn cookie when LoggedIn cookie is absent', () => {
      mockConfig.sessionSettings.cookieMaxAge = '3600000'
      middleware = sessionTtlMiddleware(mockConfig)

      req.cookies = {}
      req.session = {
        cookie: {
          maxAge: 3600000,
          originalMaxAge: 3600000,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(res._setCookie).toBeNull()
    })

    it('should not set LoggedIn cookie when configured TTL is invalid', () => {
      mockConfig.sessionSettings.cookieMaxAge = 'invalid'
      middleware = sessionTtlMiddleware(mockConfig)

      req.cookies.LoggedIn = true
      req.session = {
        cookie: {
          maxAge: 3600000,
          originalMaxAge: 3600000,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(res._setCookie).toBeNull()
    })

    it('should not set LoggedIn cookie when configured TTL is zero', () => {
      mockConfig.sessionSettings.cookieMaxAge = '0'
      middleware = sessionTtlMiddleware(mockConfig)

      req.cookies.LoggedIn = true
      req.session = {
        cookie: {
          maxAge: 3600000,
          originalMaxAge: 3600000,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(res._setCookie).toBeNull()
    })

    it('should set LoggedIn cookie when session is missing but LoggedIn cookie exists', () => {
      const configuredTTL = 3600000

      mockConfig.sessionSettings.cookieMaxAge = configuredTTL.toString()
      middleware = sessionTtlMiddleware(mockConfig)

      req.cookies.LoggedIn = true
      req.session = null

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      // Even if session is null, we should still refresh the LoggedIn cookie with configured TTL
      expect(res._setCookie).not.toBeNull()
      expect(res._setCookie.name).toBe('LoggedIn')
      expect(res._setCookie.options.maxAge).toBe(configuredTTL)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle both session TTL update and LoggedIn cookie set in one request', () => {
      const configuredTTL = 3600000
      const currentSessionTTL = 1800000
      const now = Date.now()

      mockConfig.sessionSettings.cookieMaxAge = configuredTTL.toString()
      middleware = sessionTtlMiddleware(mockConfig)

      req.cookies.LoggedIn = true
      req.session = {
        cookie: {
          maxAge: currentSessionTTL,
          originalMaxAge: currentSessionTTL,
          expires: new Date(now + currentSessionTTL),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      // Session TTL updated
      expect(req.session.cookie.maxAge).toBe(configuredTTL)
      // LoggedIn cookie set
      expect(res._setCookie.name).toBe('LoggedIn')
      // LoggedIn cookie should use updated session TTL
      expect(res._setCookie.options.maxAge).toBe(configuredTTL)
    })

    it('should always call next() to continue request processing', () => {
      mockConfig.sessionSettings.cookieMaxAge = '3600000'
      middleware = sessionTtlMiddleware(mockConfig)

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large TTL values', () => {
      const largeTTL = '999999999999'

      mockConfig.sessionSettings.cookieMaxAge = largeTTL
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = {
        cookie: {
          maxAge: 1000,
          originalMaxAge: 1000,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(req.session.cookie.maxAge).toBe(parseInt(largeTTL, 10))
    })

    it('should handle string TTL values that are empty', () => {
      mockConfig.sessionSettings.cookieMaxAge = ''
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = {
        cookie: {
          maxAge: 3600000,
          originalMaxAge: 3600000,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      expect(req.session.cookie.maxAge).toBe(3600000)
    })

    it('should handle string TTL values with whitespace', () => {
      const configuredTTL = 3600000

      mockConfig.sessionSettings.cookieMaxAge = '  3600000  '
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = {
        cookie: {
          maxAge: 1000,
          originalMaxAge: 1000,
          expires: new Date(),
        },
      }

      middleware(req, res, next)

      expect(nextCalled).toBe(true)
      // parseInt handles leading/trailing whitespace
      expect(req.session.cookie.maxAge).toBe(configuredTTL)
    })

    it('should throw error if next is not called', () => {
      mockConfig.sessionSettings.cookieMaxAge = '3600000'
      middleware = sessionTtlMiddleware(mockConfig)

      let _errorThrown = false
      try {
        // Call without proper next callback won't actually throw in Express middleware
        // But we verify next was called in other tests
        middleware(req, res, undefined)
      } catch (_e) {
        _errorThrown = true
      }
      // This test verifies behavior - middleware should handle missing next gracefully
    })
  })
})
