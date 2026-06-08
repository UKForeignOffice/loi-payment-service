import { createLogger, format, transports } from 'winston'

const { combine, timestamp, simple, logstash, colorize } = format

const nonProductionLogFormat = format.combine(colorize({ level: true }), format.splat(), simple())

const productionLogstashFormat = combine(timestamp(), logstash())

const customFormat = process.env.NODE_ENV === 'production' ? productionLogstashFormat : nonProductionLogFormat

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'loi-payment-service' },
  transports: [new transports.Console({ level: 'info', handleExceptions: true, handleRejections: true })],
  exitOnError: false,
})

logger.info(process.env.NODE_ENV === 'production' ? 'Production logging enabled' : 'Development logging enabled')
