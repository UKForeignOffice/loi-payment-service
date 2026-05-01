import { createLogger, format, transports } from 'winston'

const { combine, timestamp, printf } = format

const customFormat = printf(({ level, message, _timestamp }) => {
  return `${level.toUpperCase()}: ${message}`
})

export const logger = createLogger({
  level: 'info',
  format: combine(
    timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    customFormat,
  ),
  transports: [
    new transports.Console({
      handleExceptions: true,
      level: 'info',
    }),
  ],
  exceptionHandlers: [
    new transports.Console({
      format: combine(format.colorize(), customFormat),
    }),
  ],
})

logger.exceptions.handle(
  new transports.Console({
    format: combine(format.colorize(), customFormat),
  }),
)
