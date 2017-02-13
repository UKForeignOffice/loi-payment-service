
var common = require('./../config/common.js');
var configSmartPay = common.config();
var crypto = require('crypto');
var zlib = require('zlib');

module.exports = {

    // sets application payment data
    addApplicationData: function(appid, formFields, applicationDetail, application, userDocumentCount, loggedIn) {

        var documentCount = userDocumentCount.doc_count;
        var documentCountLabel = documentCount == 1 ? 'document.' : 'documents.';
        var orderData = 'You are paying to legalise ' + documentCount + ' ' + documentCountLabel;

        if(loggedIn === true) {
            orderData = orderData + '<br/><br/>When adding a new card, you\'ll see a \'Remember these details\' box. Untick this box if you don\'t want to save your card for future applications.';
        }

        formFields.merchantReference = application.unique_app_id;
        formFields.orderData = orderData;
        formFields.paymentAmount = Math.round(applicationDetail.payment_amount * 1e2); // multiply by 100 to get value in minor currency
        formFields.merchantReturnData = appid;

        formFields.allowedMethods = ''; //pre-selection of card type (obsolete)

        return formFields;
    },

    // set the date fields to one day in the future
    addDateFields: function(formFields) {

        var shipBeforeDate = new Date();
        shipBeforeDate.setDate(shipBeforeDate.getDate() + 1);
        var shipBeforeDateValue = shipBeforeDate.toISOString().substr(0, 10);

        var sessionValidityDate = new Date();
        sessionValidityDate.setMinutes(sessionValidityDate.getMinutes() + configSmartPay.configs.sessionValidity);
        var sessionValidityValue = sessionValidityDate.toISOString().substr(0, 19) + 'Z';

        // add date fields to form array
        formFields.shipBeforeDate = shipBeforeDateValue;
        formFields.sessionValidity = sessionValidityValue;

        // return to caller
        return formFields;
    },

    // adds data required for saving card details
    addOneClickFields : function(appid, formFields, userDetails, applicationDetail) {

        var oneclick_reference = applicationDetail.oneclick_reference;

        // if there is a user session active, get their recurring payment reference
        // and set the relevant optional fields in the SmartPay request object
        if (oneclick_reference != '0')
        {
            formFields.shopperReference = oneclick_reference;
            formFields.recurringContract = 'ONECLICK';
            formFields.shopperEmail = userDetails.email;
        }

        // return to caller
        return formFields;
    },

    lookupPaymentMethod : function(paymentMethod) {
        return configSmartPay.paymentMethods[paymentMethod];
    },

    // compress order data using gzip, encode in base64
    // also converts the order data into HTML fragment first
    compressAndEncodeOrderData : function (formFields) {

        // put order data value into HTML paragraph tags
        var htmlFragment = '<p>' + formFields.orderData + '</p>';

        // compress using gzip and encode in base64 format
        // (blocking call so no need for callback)
        htmlFragment = zlib.gzipSync(htmlFragment).toString('base64');

        // assign encoded value back into the formFields array
        formFields.orderData = htmlFragment;

        // return to caller
        return formFields;
    },

    // calculates the signature using HMAC code
    //
    //paymentAmount + currencyCode + shipBeforeDate + merchantReference + skinCode +
    //merchantAccount + sessionValidity + shopperEmail + shopperReference +
    //allowedMethods + blockedMethods + shopperStatement + billingAddressType
    calculateMerchantSignature: function(formFields) {

        // get HMAC secret key
        var hmacKey = configSmartPay.configs.HMAC;

        // get form field values
        var paymentAmount = formFields.paymentAmount;
        var currencyCode = configSmartPay.configs.currencyCode;
        var shipBeforeDate = formFields.shipBeforeDate;
        var merchantReference = formFields.merchantReference;
        var skinCode = configSmartPay.configs.skinCode;
        var merchantAccount = configSmartPay.configs.merchantAccount;
        var sessionValidity = formFields.sessionValidity;
        var shopperEmail = formFields.shopperEmail; //optional
        var shopperReference = formFields.shopperReference; //optional
        var recurringContract = formFields.recurringContract; //optional
        var allowedMethods = formFields.allowedMethods;
        var blockedMethods = '';
        var shopperStatement = '';
        var billingAddressType = '';
        var merchantReturnData = formFields.merchantReturnData;

        // concatenate form fields into one string
        var formFieldsString = paymentAmount + currencyCode + shipBeforeDate + merchantReference + skinCode +
                               merchantAccount + sessionValidity + shopperEmail + shopperReference + recurringContract +
                               allowedMethods + blockedMethods + shopperStatement + billingAddressType + merchantReturnData;

        // calculate HMAC string and encode in base64
        var hash = crypto.createHmac('sha1', hmacKey).update(formFieldsString).digest('base64');

        // return to caller
        return hash;
    },

    // decode signature returned from SmartPay to verify data integrity using HMAC code
    //
    // authResult + pspReference + merchantReference + skinCode + merchantReturnData
    decodeReturnedMerchantSignature: function(queryString) {

        // get HMAC secret key
        var hmacKey = configSmartPay.configs.HMAC;

        // get hold of query string parameters
        var authResult = queryString.authResult;
        var pspReference = queryString.pspReference;
        var merchantReference = queryString.merchantReference;
        var skinCode = queryString.skinCode;
        var merchantReturnData = ((queryString.merchantReturnData !== undefined) ? queryString.merchantReturnData : '');

        // encoded signature we are validating against
        var merchantSig = queryString.merchantSig;

        // concatenate query string values into one string
        var queryStringValues = authResult + pspReference + merchantReference + skinCode + merchantReturnData;

        // calculate HMAC string and encode in base64
        var hash = crypto.createHmac('sha1', hmacKey).update(queryStringValues).digest('base64');

        return (hash === merchantSig);
    },

    buildParameters: function(formFields, merchantSignature) {
        var params = {
            paymentAmount      : formFields.paymentAmount,
            currencyCode       : configSmartPay.configs.currencyCode,
            shipBeforeDate     : formFields.shipBeforeDate,
            merchantReference  : formFields.merchantReference,
            skinCode           : configSmartPay.configs.skinCode,
            merchantAccount    : configSmartPay.configs.merchantAccount,
            sessionValidity    : formFields.sessionValidity,
            shopperEmail       : formFields.shopperEmail,
            shopperReference   : formFields.shopperReference,
            recurringContract  : formFields.recurringContract,
            allowedMethods     : formFields.allowedMethods,
            blockedMethods     : '',
            shopperStatement   : '',
            billingAddressType : '',
            skipSelection      : ((formFields.allowedMethods !== '') ? 'true' : ''),
            orderData          : formFields.orderData,
            merchantReturnData : formFields.merchantReturnData,
            resURL             : configSmartPay.configs.resultURL,
            merchantSig        : merchantSignature
        };

        return params;
    },

    loggedInStatus: function amILoggedIn(req) {
        if (req.session && req.session.passport && req.session.passport.user) {
            return true;
        }
        else {
            return false;
        }
    },

    /**
     * Get the email address of the current in User
     * @param req
     * @returns email {string}
     */
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
    }

};
