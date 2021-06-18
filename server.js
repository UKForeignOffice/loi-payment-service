
// =====================================
// SETUP
// =====================================
var port = (process.argv[2] && !isNaN(process.argv[2])  ? process.argv[2] : (process.env.PORT || 4321));
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');

var common = require('./config/common.js');
var configSmartPay = common.config();

// =====================================
// CONFIGURATION
// =====================================

require('./config/logs');

app.use(bodyParser()); //get information from HTML forms
app.use(cookieParser());

const redis = require('redis')
const session = require('express-session')

let RedisStore = require('connect-redis')(session)
let redisClient = redis.createClient()

app.use(
    session({
        store: new RedisStore({
            client: redisClient,
            host: configSmartPay.sessionSettings.host,
            port: configSmartPay.sessionSettings.port,
            prefix: configSmartPay.sessionSettings.prefix,
            pass: configSmartPay.sessionSettings.password
        }),
        saveUninitialized: false,
        secret: configSmartPay.sessionSettings.secret,
        key: configSmartPay.sessionSettings.key,
        resave: false,
        cookie: {
            domain: configSmartPay.sessionSettings.cookie_domain, //environmentVariables.cookieDomain,
            maxAge: configSmartPay.sessionSettings.cookieMaxAge //30 minutes
        }
    })
)

app.set('view engine', 'ejs');
app.use(function (req, res, next) {
    res.locals = {
        piwikID: configSmartPay.live_variables.piwikId,
        feedbackURL:configSmartPay.live_variables.Public ? configSmartPay.live_variables.feedbackURL : "http://www.smartsurvey.co.uk/s/2264M/",
        service_public: configSmartPay.live_variables.Public,
        start_url: configSmartPay.live_variables.startPageURL,
        govuk_url: configSmartPay.live_variables.GOVUKURL
    };
    next();
});

app.use(function(req, res, next) {
    if (req.cookies['LoggedIn']){
        res.cookie('LoggedIn',true,{ maxAge: 1800000, httpOnly: true });
    }
    return next();
});

app.use(morgan('dev')); //log every request to the console

app.use(function(req, res, next) {
    res.removeHeader("X-Powered-By");
    res.removeHeader("Server");
    return next();
});

// =====================================
// MODELS (Sequelize ORM)
// =====================================
app.set('models', require('./models'));

// =====================================
// ASSETS
// =====================================
var path = require('path');
var sassMiddleware = require('node-sass-middleware');
var srcPath = __dirname + '/sass';
var destPath = __dirname + '/public';

app.use('/api/payment',sassMiddleware({
    src: srcPath,
    dest: destPath,
    debug: false,
    outputStyle: 'compressed',
    prefix: '/api/payment/'
}));

app.use("/api/payment/",express.static(__dirname + "/public"));
app.use("/api/payment/styles",express.static(__dirname + "/styles")); //static directory for stylesheets
app.use("/api/payment/images",express.static(__dirname + "/images")); //static directory for images

// =====================================
// ROUTES
// =====================================
var router = express.Router(); //get instance of Express router
require('./app/routes.js')(router, configSmartPay, app); //load routes passing in app and configuration
app.use('/api/payment', router); //prefix all requests with 'api/payment'

//Pull in images from GOVUK packages
var fs = require('fs-extra');
fs.copy('node_modules/govuk_frontend_toolkit/images', 'images/govuk_frontend_toolkit', function (err) {
    if (err) return null;
});
fs.mkdirs('images/govuk_frontend_toolkit/icons', function (err) {
    if (err) return null;
});
fs.readdir('images/govuk_frontend_toolkit', function(err, items) {
    for (var i=0; i<items.length; i++) {
        if('images/govuk_frontend_toolkit/'+items[i].substr(0,5)=='images/govuk_frontend_toolkit/icon-' && items[i].substr(items[i].length-3,3)=='png'){
            fs.move('images/govuk_frontend_toolkit/'+items[i], 'images/govuk_frontend_toolkit/icons/'+items[i],{ clobber: true }, function (err) {
                if (err) return null;
            });
        }
    }
});

// =====================================
// LAUNCH
// =====================================
app.listen(port);
console.log('is-payment-service running on port: ' + port);
module.exports.getApp = app;




