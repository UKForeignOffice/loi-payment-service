
// =====================================
// SETUP
// =====================================
const port = (process.argv[2] && !isNaN(process.argv[2])  ? process.argv[2] : (process.env.PORT || 4321));
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const common = require('./config/common.js');
const configGovPay = common.config();

// =====================================
// CONFIGURATION
// =====================================

require('./config/logs');

app.use(bodyParser()); //get information from HTML forms
app.use(cookieParser());

const session = require("express-session")
let RedisStore = require("connect-redis")(session)

const { createClient } = require("redis")
let redisClient = createClient({
    legacyMode: true,
    password: configGovPay.sessionSettings.password,
    socket: {
        port: configGovPay.sessionSettings.port,
        host: configGovPay.sessionSettings.host,
        tls: process.env.NODE_ENV !== 'development'
    }
})

redisClient.connect().catch(console.error)

app.use(
    session({
        store: new RedisStore({ client: redisClient }),
        prefix: configGovPay.sessionSettings.prefix,
        saveUninitialized: false,
        secret: configGovPay.sessionSettings.secret,
        key: configGovPay.sessionSettings.key,
        resave: false,
        rolling: true,
        cookie: {
            domain: configGovPay.sessionSettings.domain,
            maxAge: configGovPay.sessionSettings.maxAge,
            secure: 'auto'
        }
    })
)

app.set('view engine', 'ejs');
app.use(function (req, res, next) {
    res.locals = {
        piwikID: configGovPay.live_variables.piwikId,
        feedbackURL:configGovPay.live_variables.Public ? configGovPay.live_variables.feedbackURL : "https://www.gov.uk/done/get-document-legalised",
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
const path = require('path');

app.use("/api/payment/",express.static(__dirname + "/public"));
app.use("/api/payment/styles",express.static(__dirname + "/styles")); //static directory for stylesheets
app.use("/api/payment/images",express.static(__dirname + "/images")); //static directory for images

// =====================================
// ROUTES
// =====================================
const router = express.Router(); //get instance of Express router
require('./app/routes.js')(router, configGovPay, app); //load routes passing in app and configuration
app.use('/api/payment', router); //prefix all requests with 'api/payment'

//Pull in images from GOVUK packages
const fs = require('fs-extra');
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
const schedule = require('node-schedule');
const jobs = require('./config/jobs.js');

// As there are 2 instances running, we need a random time, or the job will be executed on both instances
const randomSecond = Math.floor(Math.random() * 60);
const randomMin = Math.floor(Math.random() * 60); //Math.random returns a number from 0 to < 1 (never will return 60)
const jobScheduleRandom = randomSecond + " " + randomMin + " " + "*/" + configGovPay.configs.jobScheduleHourlyInterval + " * * *";
const paymentCleanup = schedule.scheduleJob(jobScheduleRandom, function(){jobs.paymentCleanup()});

// =====================================
// LAUNCH
// =====================================
app.listen(port);
console.log('is-payment-service running on port: ' + port);
console.log('payment cleanup job will run every %s hours at %sm %ss past the hour', configGovPay.configs.jobScheduleHourlyInterval, randomMin, randomSecond);
module.exports.getApp = app;
