
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
var configGovPay = common.config();
var session = require('express-session');
var RedisStore = require('connect-redis')(session);

// =====================================
// CONFIGURATION
// =====================================

require('./config/logs');

app.use(bodyParser()); //get information from HTML forms
app.use(cookieParser());
var store = new RedisStore({
        host: configGovPay.sessionSettings.host,
        port: configGovPay.sessionSettings.port,
        prefix: configGovPay.sessionSettings.prefix,
        pass: configGovPay.sessionSettings.password,
        tls: {}
});
app.set('view engine', 'ejs');
app.use(function (req, res, next) {
    res.locals = {
        piwikID: configGovPay.live_variables.piwikId,
        feedbackURL:configGovPay.live_variables.Public ? configGovPay.live_variables.feedbackURL : "http://www.smartsurvey.co.uk/s/2264M/",
        service_public: configGovPay.live_variables.Public,
        start_url: configGovPay.live_variables.startPageURL,
        govuk_url: configGovPay.live_variables.GOVUKURL
    };
    next();
});
app.use(function(req, res, next) {
    if (req.cookies['LoggedIn']){
        res.cookie('LoggedIn',true,{ maxAge: 1800000, httpOnly: true });
    }
    return next();
});
app.use(session({
    secret: configGovPay.sessionSettings.secret,
    key: configGovPay.sessionSettings.key,
    store: store,
    resave: false,
    saveUninitialized: false,
    cookie: {
        domain: configGovPay.sessionSettings.cookie_domain ,//environmentVariables.cookieDomain,
        maxAge: configGovPay.sessionSettings.cookieMaxAge  //30 minutes
    }
}));
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
require('./app/routes.js')(router, configGovPay, app); //load routes passing in app and configuration
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
// JOB SCHEDULER
// =====================================
//Schedule and run account expiry job every day
var schedule = require('node-schedule');
var jobs = require('./config/jobs.js');

// As there are 2 instances running, we need a random time, or the job will be executed on both instances
var randomSecond = Math.floor(Math.random() * 60);
var randomMin = Math.floor(Math.random() * 60); //Math.random returns a number from 0 to < 1 (never will return 60)
//var jobScheduleRandom = randomSecond + " " + randomMin + " " + "*/" + configGovPay.configs.jobScheduleHourlyInterval + " * * *";
var jobScheduleRandom = "0 * * * * *";
var paymentCleanup = schedule.scheduleJob(jobScheduleRandom, function(){jobs.paymentCleanup()});

// =====================================
// LAUNCH
// =====================================
app.listen(port);
console.log('is-payment-service running on port: ' + port);
module.exports.getApp = app;




