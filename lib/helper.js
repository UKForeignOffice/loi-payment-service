
var common = require('./../config/common.js');
var configSmartPay = common.config();
var crypto = require('crypto');

module.exports = {

    buildUkPayData: function(formFields, applicationDetail, application, usersEmail) {
        formFields.amount = Math.round(applicationDetail.payment_amount * 1e2);
        formFields.reference = application.unique_app_id
        formFields.description = "Pay to get documents legalised"
        formFields.return_url = configSmartPay.configs.resultURL
        formFields.delayedCapture = false
        formFields.email = usersEmail
        return formFields
    },

    loggedInStatus: function amILoggedIn(req) {
        if (req.session && req.session.passport && req.session.passport.user) {
            return true;
        }
        else {
            return false;
        }
    },

    loggedInUserEmail: function whatsUsersEmail(req)
    {
        if (req.session && req.session.passport && req.session.passport.user && req.session.email && req.session.email !== null) {
            return req.session.email;
        } else {
            return 'Not Logged In';
        }
    },

    isSessionValid: function getSomeSessionInfo(req) {
        if (typeof(req.session.appSubmittedStatus) != 'undefined') {
            console.log('session is valid - proceed to payment unsuccessful page');
            return true;
        }else{
            console.log('session is invalid - proceed to session expiry page');
            return false;
        }
    },

    additionalPaymentsAddBaseData: function (formFields, cost, email) {
        let moment = require('moment');

        formFields.amount = Math.round(cost * 1e2)
        formFields.reference = moment().unix().toString()
        formFields.description = "Make an additional payment"
        formFields.return_url = configSmartPay.configs.additionalPaymentsReturnURL
        formFields.delayedCapture = false
        formFields.email = email
        return formFields;
    }

};
