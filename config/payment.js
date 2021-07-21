/**
 * Created by skaifem on 10/12/2015.
 */

require('dotenv').config()
var resultURL = JSON.parse(process.env.RESULTURL);
var notificationServiceURL = JSON.parse(process.env.NOTIFICATIONSERVICEURL);
var applicationServiceReturnUrl = JSON.parse(process.env.APPLICATIONSERVICERETURNURL);
var startNewApplicationUrl = JSON.parse(process.env.STARTNEWAPPLICATIONURL);
var cookieDomain = JSON.parse(process.env.COOKIEDOMAIN);
var db = JSON.parse(process.env.DATABASE);
var live_variables = JSON.parse(process.env.LIVEVARIABLES);
var sessionSettings = JSON.parse(process.env.THESESSION);
var ukPayUrl = JSON.parse(process.env.UKPAYURL);
var ukPayApiKey = JSON.parse(process.env.UKPAYAPIKEY);

var configs = {
    "resultURL":resultURL.resultURL,
    "additionalPaymentsReturnURL":resultURL.additionalPaymentsReturnURL,
    "notificationServiceURL":notificationServiceURL.notificationServiceURL,
    "applicationServiceReturnUrl" : applicationServiceReturnUrl.applicationServiceReturnUrl,
    "startNewApplicationUrl" : startNewApplicationUrl.startNewApplicationUrl,
    "cookieDomain": cookieDomain.cookieDomain,
    "ukPayApiKey": ukPayApiKey.ukPayApiKey,
    "ukPayUrl": ukPayUrl.ukPayUrl
};

var database = db.database;

var config = {configs: configs, database: database, "live_variables":live_variables, sessionSettings: sessionSettings};

module.exports = config;
