const { createLogger, transports, format } = require('winston');
const { combine, timestamp, printf, colorize } = format;

const logger = createLogger({
    transports: [
        /* Log info to console */
        new transports.Console({
            format: combine(
                colorize(),
                timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss',
                }),
                printf((info) => {
                    const { message, timestamp, meta } = info;
                    return `${timestamp} ${info.level}: ${message}` + (meta ? `\n${JSON.stringify(meta)}` : '');
                }),
            ),
            level: 'info',
            handleExceptions: true,
        }),
        /* Log errors to console */
        new transports.Console({
            format: combine(
                colorize(),
                timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss',
                }),
                printf((info) => {
                    const { message, timestamp, meta } = info;
                    return `${timestamp} ${info.level}: ${message}` + (meta ? `\n${JSON.stringify(meta)}` : '');
                }),
            ),
            level: 'error',
            handleExceptions: true,
        }),
    ],
});

// Overwrite some built-in console functions
console.error = logger.error.bind(logger);
console.log = logger.info.bind(logger);
console.info = logger.info.bind(logger);
console.debug = logger.debug.bind(logger);
console.warn = logger.warn.bind(logger);
