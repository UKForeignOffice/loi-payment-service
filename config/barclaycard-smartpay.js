/**
 * Created by skaifem on 10/12/2015.
 */

require('dotenv').config()
var HMAC = JSON.parse(process.env.HMAC);
var skinCode = JSON.parse(process.env.SKINCODE);
var currencyCode = JSON.parse(process.env.CURRENCYCODE);
var merchantAccount = JSON.parse(process.env.MERCHANTACCOUNT);
var resultURL = JSON.parse(process.env.RESULTURL);
var notificationServiceURL = JSON.parse(process.env.NOTIFICATIONSERVICEURL);
var sessionValidity = JSON.parse(process.env.SESSIONVALIDITY);
var applicationServiceReturnUrl = JSON.parse(process.env.APPLICATIONSERVICERETURNURL);
var smartPayUrl = JSON.parse(process.env.SMARTPAYURL);
var smartPayHMACTestUrl = JSON.parse(process.env.SMARTPAYHMACTESTURL);
var startNewApplicationUrl = JSON.parse(process.env.STARTNEWAPPLICATIONURL);
var mongoURL = JSON.parse(process.env.MONGOURL);
var cookieDomain = JSON.parse(process.env.COOKIEDOMAIN);
var paymentMethods = JSON.parse(process.env.PAYMENTMETHODS);
var db = JSON.parse(process.env.DATABASE);
var live_variables = JSON.parse(process.env.LIVEVARIABLES);

var configs = {
    "HMAC" : HMAC.HMAC,
    "skinCode": skinCode.skinCode,
    "currencyCode": currencyCode.currencyCode,
    "merchantAccount": merchantAccount.merchantAccount,
    "resultURL":resultURL.resultURL,
    "additionalPaymentsReturnURL":resultURL.additionalPaymentsReturnURL,
    "notificationServiceURL":notificationServiceURL.notificationServiceURL,
    "sessionValidity":sessionValidity.sessionValidity,
    "applicationServiceReturnUrl" : applicationServiceReturnUrl.applicationServiceReturnUrl,
    "smartPayUrl" : smartPayUrl.smartPayUrl,
    "smartPayHMACTestUrl" : smartPayHMACTestUrl.smartPayHMACTestUrl,
    "startNewApplicationUrl" : startNewApplicationUrl.startNewApplicationUrl,
    "mongoURL": mongoURL.mongoURL,
    "cookieDomain": cookieDomain.cookieDomain
};

var database = db.database;

var config = {configs: configs, paymentMethods: paymentMethods, database: database, "live_variables":live_variables};

//console.log(JSON.stringify(configs));

module.exports = config;
