var winston = require('winston');
var logger = new winston.Logger({
    transports: [
        /*Log info to console*/
        new (winston.transports.Console)({
            timestamp: function () {
                return getTimeStamp();
            },
            formatter: function (options) {
                return '' + (undefined !== options.message ? options.message : '') +
                    (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '' );
            },
            name: 'info-console',
            level: 'info',
            handleExceptions: true,
            humanReadableUnhandledException: true
        }),
        /*Log info to file */
        new (winston.transports.File)({
            timestamp: function () {
                return getTimeStamp();
            },
            formatter: function (options) {
                return options.timestamp() + ' ' + options.level.toUpperCase() + ' ' + (undefined !== options.message ? options.message : '') +
                    (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '' );
            },
            name: 'info-file',
            filename: './logs/fco-loi-payment-service-info.log',
            level: 'info',
            handleExceptions: true,
            humanReadableUnhandledException: true,
            json: false
        }),
        /*Log errors to file */
        new (winston.transports.File)({
            timestamp: function () {
                return getTimeStamp();
            },
            formatter: function (options) {
                return options.timestamp() + ' ' + options.level.toUpperCase() + ' ' + (undefined !== options.message ? options.message : '') +
                    (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '' );
            },
            name: 'error-file',
            filename: './logs/fco-loi-payment-service-error.log',
            level: 'error',
            handleExceptions: true,
            humanReadableUnhandledException: true,
            json: false
        }),
        /*Log errors to console */
        new (winston.transports.Console)({
            timestamp: function () {
                return getTimeStamp();
            },
            formatter: function (options) {
                return '' + (undefined !== options.message ? options.message : '') +
                    (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '' );
            },
            name: 'error-console',
            level: 'error',
            handleExceptions: true,
            humanReadableUnhandledException: true
        })
    ]
});

// Overwrite some of the build-in console functions
console.error = logger.error;
console.log = logger.info;
console.info = logger.info;
console.debug = logger.debug;
console.warn = logger.warn;

function getTimeStamp() {
    var date = new Date();
    return date.toISOString();
}
