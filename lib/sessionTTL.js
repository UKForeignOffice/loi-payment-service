/**
 * Session TTL Middleware
 * Ensures session and LoggedIn cookie TTLs are kept up-to-date with configured values
 * @param {Object} configGovPay - Configuration object containing sessionSettings
 * @returns {Function} Express middleware function
 */
module.exports = function sessionTtlMiddleware(configGovPay) {
    return function(req, res, next) {
        const configuredSessionTtl = parseInt(configGovPay.sessionSettings.cookieMaxAge, 10);

        // Update session TTL if session exists and configured TTL is valid
        if (req.session && req.session.cookie && !isNaN(configuredSessionTtl) && configuredSessionTtl > 0) {
            const sessionTtl = parseInt(req.session.cookie.originalMaxAge, 10);

            if (isNaN(sessionTtl) || sessionTtl < configuredSessionTtl) {
                req.session.cookie.maxAge = configuredSessionTtl;
                req.session.cookie.originalMaxAge = configuredSessionTtl;
                req.session.cookie.expires = new Date(Date.now() + configuredSessionTtl);
            }
        }

        // Refresh LoggedIn cookie if it exists and configured TTL is valid
        if (req.cookies['LoggedIn'] && !isNaN(configuredSessionTtl) && configuredSessionTtl > 0) {
            const sessionTtl = req.session && req.session.cookie && parseInt(req.session.cookie.originalMaxAge, 10);
            const loggedInCookieMaxAge = !isNaN(sessionTtl) && sessionTtl > 0
                ? sessionTtl
                : configuredSessionTtl;

            res.cookie('LoggedIn', true, { maxAge: loggedInCookieMaxAge, httpOnly: true });
        }

        return next();
    };
};
