
var common = require('./../config/common.js');
var configGovPay = common.config();

module.exports = {

    buildUkPayData: function(formFields, applicationDetail, application, usersEmail) {
        formFields.amount = Math.round(applicationDetail.payment_amount * 1e2);
        formFields.reference = application.unique_app_id
        formFields.description = "Pay to get documents legalised"
        formFields.return_url = configGovPay.configs.resultURL + '?id=' + application.application_id
        formFields.delayedCapture = false
        formFields.email = usersEmail
        return formFields
    },

    loggedInStatus: function amILoggedIn(req) {
        return !!(req.session.passport &&
            req.session.passport.user &&
            (req.session.method === 'plain' || req.session.method === 'totp' && req.session.secondFactorSuccess === true));
    },

    loggedInUserEmail: function whatsUsersEmail(req)
    {
        if (req.session && req.session.passport && req.session.passport.user && req.session.email && req.session.email !== null) {
            return req.session.email;
        } else {
            return 'Not Logged In';
        }
    },

    loggedOutUserEmail: function getUserEmail(req)
    {
        if (typeof req.session.user_addresses.main.address.email !== 'undefined'){
            return req.session.user_addresses.main.address.email
        } else {
            return ''
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

    additionalPaymentsAddBaseData: function (formFields, applicationRef, cost, email) {
        let moment = require('moment');

        formFields.amount = Math.round(cost * 1e2)
        formFields.reference = (applicationRef) ? applicationRef : moment().unix().toString()
        formFields.description = "Make an additional payment"
        formFields.return_url = configGovPay.configs.additionalPaymentsReturnURL
        formFields.delayedCapture = false
        formFields.email = email
        return formFields;
    }

};
