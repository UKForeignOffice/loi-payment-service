import { afterEach, describe, expect, it, vi } from 'vitest'

const messageSymbol = Symbol.for('message')
const levelSymbol = Symbol.for('level')

const originalNodeEnv = process.env.NODE_ENV
const originalLogLevel = process.env.LOG_LEVEL

const loadLogger = async ({ nodeEnv, logLevel } = {}) => {
  vi.resetModules()

  if (nodeEnv === undefined) {
    delete process.env.NODE_ENV
  } else {
    process.env.NODE_ENV = nodeEnv
  }

  if (logLevel === undefined) {
    delete process.env.LOG_LEVEL
  } else {
    process.env.LOG_LEVEL = logLevel
  }

  const module = await import('../../../config/logs.js')
  return module.logger
}

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV
  } else {
    process.env.NODE_ENV = originalNodeEnv
  }

  if (originalLogLevel === undefined) {
    delete process.env.LOG_LEVEL
  } else {
    process.env.LOG_LEVEL = originalLogLevel
  }

  vi.restoreAllMocks()
})

describe('logger', () => {
  describe('when running in non-production environment', () => {
    const nodeEnv = 'non-prod'
    it('defaults to info level when LOG_LEVEL is not set', async () => {
      const logger = await loadLogger({ nodeEnv })

      expect(logger.level).toBe('info')
    })

    it('uses LOG_LEVEL when provided', async () => {
      const logger = await loadLogger({ nodeEnv, logLevel: 'debug' })

      expect(logger.level).toBe('debug')
    })

    it('uses colored simple text format outside production', async () => {
      const logger = await loadLogger({ nodeEnv })

      const transformed = logger.format.transform({
        level: 'info',
        [levelSymbol]: 'info',
        message: 'hello world',
      })

      expect(transformed[messageSymbol]).toBe('\u001b[32minfo\u001b[39m: hello world')
    })

    it('formats metadata passed as second argument to logger.info', async () => {
      const logger = await loadLogger({ nodeEnv })
      const transportLogSpy = vi.spyOn(logger.transports[0], 'log').mockImplementation((_info, next) => {
        if (next) next()
      })

      logger.info('hello', { foo: 'bar' })

      expect(transportLogSpy).toHaveBeenCalledTimes(1)
      const infoArg = transportLogSpy.mock.calls[0][0]
      expect(infoArg[messageSymbol]).toBe(
        '\u001b[32minfo\u001b[39m: hello {"foo":"bar","service":"loi-payment-service"}',
      )
    })
  })

  describe('when running in production environment', () => {
    const nodeEnv = 'production'
    it('uses logstash JSON format in production', async () => {
      const logger = await loadLogger({ nodeEnv })

      const transformed = logger.format.transform({ level: 'info', message: 'hello world' })
      const payload = JSON.parse(transformed[messageSymbol])

      expect(payload['@message']).toBe('hello world')
      expect(payload['@fields'].level).toBe('info')
      expect(payload['@timestamp']).toBeTypeOf('string')
    })
  })

  it('configures a console transport with exception and rejection handlers', async () => {
    const logger = await loadLogger({ nodeEnv: '' })

    expect(logger.transports).toHaveLength(1)
    expect(logger.transports[0].name).toBe('console')
    expect(logger.transports[0].level).toBe('info')
    expect(logger.transports[0].handleExceptions).toBe(true)
    expect(logger.transports[0].handleRejections).toBe(true)
  })
})
