const { createLogger, format, transports } = require('winston')
const { combine, timestamp, printf } = format

const customFormat = printf(({ level, message, _timestamp }) => {
  return `${level.toUpperCase()}: ${message}`
})

const logger = createLogger({
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

console.error = (...args) => logger.error(...args)
console.log = (...args) => logger.info(...args)
console.info = (...args) => logger.info(...args)
console.debug = (...args) => logger.debug(...args)
console.warn = (...args) => logger.warn(...args)
