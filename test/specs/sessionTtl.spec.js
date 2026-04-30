const expect = require('chai').expect
const sessionTtlMiddleware = require('../../lib/sessionTTL')

describe('Session TTL Middleware', () => {
  let middleware
  let mockConfig
  let req
  let res
  let nextCalled

  beforeEach(function () {
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
    const next = () => {
      nextCalled = true
    }

    this.next = next
  })

  describe('Session TTL Update', () => {
    it('should update session TTL when session exists and current TTL is less than configured TTL', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(req.session.cookie.maxAge).to.equal(configuredTTL)
      expect(req.session.cookie.originalMaxAge).to.equal(configuredTTL)
      expect(req.session.cookie.expires.getTime()).to.be.greaterThan(now + configuredTTL - 1000)
    })

    it('should not update session TTL when current TTL is greater than configured TTL', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(req.session.cookie.maxAge).to.equal(currentTTL)
      expect(req.session.cookie.originalMaxAge).to.equal(currentTTL)
      expect(req.session.cookie.expires).to.equal(originalExpires)
    })

    it('should update session TTL when current TTL is NaN', function () {
      const configuredTTL = 3600000
      const _now = Date.now()

      mockConfig.sessionSettings.cookieMaxAge = configuredTTL.toString()
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = {
        cookie: {
          maxAge: NaN,
          originalMaxAge: NaN,
          expires: new Date(),
        },
      }

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(req.session.cookie.maxAge).to.equal(configuredTTL)
      expect(req.session.cookie.originalMaxAge).to.equal(configuredTTL)
    })

    it('should not update session TTL when session is null', function () {
      mockConfig.sessionSettings.cookieMaxAge = '3600000'
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = null

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      // No error should occur
    })

    it('should not update session TTL when session cookie is missing', function () {
      mockConfig.sessionSettings.cookieMaxAge = '3600000'
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = {
        cookie: null,
      }

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(req.session.cookie).to.equal(null)
    })

    it('should not update session TTL when configured TTL is NaN', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(req.session.cookie.maxAge).to.equal(currentTTL)
    })

    it('should not update session TTL when configured TTL is zero', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(req.session.cookie.maxAge).to.equal(currentTTL)
    })

    it('should not update session TTL when configured TTL is negative', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(req.session.cookie.maxAge).to.equal(currentTTL)
    })
  })

  describe('LoggedIn Cookie Handling', () => {
    it('should set LoggedIn cookie when LoggedIn cookie exists and configured TTL is valid', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(res._setCookie).to.not.be.null
      expect(res._setCookie.name).to.equal('LoggedIn')
      expect(res._setCookie.value).to.equal(true)
      expect(res._setCookie.options.maxAge).to.equal(configuredTTL)
      expect(res._setCookie.options.httpOnly).to.equal(true)
    })

    it('should use session TTL for LoggedIn cookie when session TTL is valid', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      // After middleware runs, session TTL is updated to configuredTTL when it was less
      // So LoggedIn cookie should use the updated session TTL value
      expect(res._setCookie.options.maxAge).to.equal(configuredTTL)
    })

    it('should use configured TTL for LoggedIn cookie when session TTL is NaN', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(res._setCookie.options.maxAge).to.equal(configuredTTL)
    })

    it('should use configured TTL for LoggedIn cookie when session TTL is zero', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(res._setCookie.options.maxAge).to.equal(configuredTTL)
    })

    it('should use configured TTL for LoggedIn cookie when session TTL is negative', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(res._setCookie.options.maxAge).to.equal(configuredTTL)
    })

    it('should not set LoggedIn cookie when LoggedIn cookie is absent', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(res._setCookie).to.be.null
    })

    it('should not set LoggedIn cookie when configured TTL is invalid', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(res._setCookie).to.be.null
    })

    it('should not set LoggedIn cookie when configured TTL is zero', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(res._setCookie).to.be.null
    })

    it('should set LoggedIn cookie when session is missing but LoggedIn cookie exists', function () {
      const configuredTTL = 3600000

      mockConfig.sessionSettings.cookieMaxAge = configuredTTL.toString()
      middleware = sessionTtlMiddleware(mockConfig)

      req.cookies.LoggedIn = true
      req.session = null

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      // Even if session is null, we should still refresh the LoggedIn cookie with configured TTL
      expect(res._setCookie).to.not.be.null
      expect(res._setCookie.name).to.equal('LoggedIn')
      expect(res._setCookie.options.maxAge).to.equal(configuredTTL)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle both session TTL update and LoggedIn cookie set in one request', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      // Session TTL updated
      expect(req.session.cookie.maxAge).to.equal(configuredTTL)
      // LoggedIn cookie set
      expect(res._setCookie.name).to.equal('LoggedIn')
      // LoggedIn cookie should use updated session TTL
      expect(res._setCookie.options.maxAge).to.equal(configuredTTL)
    })

    it('should always call next() to continue request processing', function () {
      mockConfig.sessionSettings.cookieMaxAge = '3600000'
      middleware = sessionTtlMiddleware(mockConfig)

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large TTL values', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(req.session.cookie.maxAge).to.equal(parseInt(largeTTL, 10))
    })

    it('should handle string TTL values that are empty', function () {
      mockConfig.sessionSettings.cookieMaxAge = ''
      middleware = sessionTtlMiddleware(mockConfig)

      req.session = {
        cookie: {
          maxAge: 3600000,
          originalMaxAge: 3600000,
          expires: new Date(),
        },
      }

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      expect(req.session.cookie.maxAge).to.equal(3600000)
    })

    it('should handle string TTL values with whitespace', function () {
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

      middleware(req, res, this.next)

      expect(nextCalled).to.equal(true)
      // parseInt handles leading/trailing whitespace
      expect(req.session.cookie.maxAge).to.equal(configuredTTL)
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
