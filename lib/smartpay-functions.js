
var common = require('./../config/common.js');
var configSmartPay = common.config();
var crypto = require('crypto');
var zlib = require('zlib');

// Using https://docs.adyen.com/developers/ecommerce-integration/hmac-signature-calculation for sending and receiving payments

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
        return configSmartPay.paymentMethods.paymentMethods[paymentMethod];
    },

    // calculates the signature using HMAC code
    //
    calculateMerchantSignature: function(formFields) {

        // get HMAC secret key
        var hmacKey = configSmartPay.configs.HMAC;

        var data = {
            paymentAmount      : formFields.paymentAmount,
            currencyCode       : configSmartPay.configs.currencyCode,
            shipBeforeDate     : formFields.shipBeforeDate,
            merchantReference  : formFields.merchantReference,
            skinCode           : configSmartPay.configs.skinCode,
            merchantAccount    : configSmartPay.configs.merchantAccount,
            sessionValidity    : formFields.sessionValidity,
            shopperEmail       : formFields.shopperEmail || '',
            shopperReference   : formFields.shopperReference || '',
            recurringContract  : formFields.recurringContract || '',
            allowedMethods     : formFields.allowedMethods,
            blockedMethods     : '',
            shopperStatement   : '',
            billingAddressType : '',
            skipSelection      : ((formFields.allowedMethods !== '') ? 'true' : ''),
            orderData          : formFields.orderData,
            merchantReturnData : formFields.merchantReturnData,
            resURL             : configSmartPay.configs.resultURL
        }

        //sort the payment details into alphabetical order (sorted by key)
        var orderedData = {};
        Object.keys(data).sort().forEach(function(key) {
            orderedData[key] = data[key];
        });

        //Concatenate all the keys together, followed by all the values delimited by colon (key:key:key:key:value:value:value:value)
        var keys = []
        var values = []
        for (var key in orderedData) {
            keys.push(key)
            values.push(orderedData[key].toString().replace(/:/g,'\\:'))
        }
        var signingString = keys.concat(values).join(":");

        // calculate HMAC string and encode in base64
        var hash = crypto.createHmac('sha256', new Buffer(hmacKey, 'hex')).update(signingString, 'utf-8').digest('base64');

        // return to caller
        return hash;
    },

    // decode signature returned from SmartPay to verify data integrity using HMAC code
    decodeReturnedMerchantSignature: function(queryString) {

        if (queryString.authResult === 'AUTHORISED') {
        // get HMAC secret key
        var hmacKey = configSmartPay.configs.HMAC;

        // get hold of query string parameters
        var data = {
            authResult: queryString.authResult,
            pspReference: queryString.pspReference,
            merchantReference: queryString.merchantReference,
            skinCode: queryString.skinCode,
            merchantReturnData: ((queryString.merchantReturnData !== undefined) ? queryString.merchantReturnData : ''),
            paymentMethod: queryString.paymentMethod,
            shopperLocale: queryString.shopperLocale,
            skinCode: queryString.skinCode
        }

        //sort the payment details into alphabetical order (sorted by key)
        var orderedData = {};
        Object.keys(data).sort().forEach(function (key) {
            //console.log("key " + JSON.stringify(key) + " and " + data[key])
            orderedData[key] = data[key];
        });

        //Concatenate all the keys together, followed by all the values delimited by colon (key:key:key:key:value:value:value:value)
        var keys = []
        var values = []
        for (var key in orderedData) {
            //console.log(orderedData[key])
            keys.push(key)
            values.push(orderedData[key].toString().replace(/:/g, '\\:'))
        }
        var queryStringValues = keys.concat(values).join(":");

        // encoded signature we are validating against
        var merchantSig = queryString.merchantSig;

        // calculate HMAC string and encode in base64
        var hash = crypto.createHmac('sha256', new Buffer(hmacKey, 'hex')).update(queryStringValues, 'utf-8').digest('base64');

        return (hash === merchantSig);
    }
    else {
            return false
        }
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
            shopperEmail       : formFields.shopperEmail || '',
            shopperReference   : formFields.shopperReference || '',
            recurringContract  : formFields.recurringContract || '',
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
    },

    //===================================
    //      ADDITIONAL PAYMENTS
    //===================================

    additionalPaymentsAddBaseData: function (formFields, cost, email) {
        let moment = require('moment');

        formFields.amount = Math.round(cost * 1e2)
        formFields.reference = moment().unix().toString()
        formFields.description = "Make an additional payment"
        formFields.return_url = configSmartPay.configs.additionalPaymentsReturnURL
        formFields.delayedCapture = false
        formFields.email = email
        return formFields;
    },

    additionalPaymentsCalculateMerchantSignature: function(formFields) {

        // Get HMAC secret key
        let hmacKey = configSmartPay.configs.HMAC;

        // Build data object
        let data = {
            paymentAmount      : formFields.paymentAmount,
            currencyCode       : configSmartPay.configs.currencyCode,
            shipBeforeDate     : formFields.shipBeforeDate,
            merchantReference  : formFields.merchantReference,
            skinCode           : configSmartPay.configs.skinCode,
            merchantAccount    : configSmartPay.configs.merchantAccount,
            sessionValidity    : formFields.sessionValidity,
            shopperEmail       : formFields.shopperEmail || '',
            shopperReference   : formFields.shopperReference || '',
            recurringContract  : formFields.recurringContract || '',
            allowedMethods     : formFields.allowedMethods,
            blockedMethods     : '',
            shopperStatement   : '',
            billingAddressType : '',
            skipSelection      : ((formFields.allowedMethods !== '') ? 'true' : ''),
            orderData          : formFields.orderData,
            merchantReturnData : formFields.merchantReturnData,
            resURL             : configSmartPay.configs.additionalPaymentsReturnURL
        };

        // Sort the payment details into alphabetical order (sorted by key)
        let orderedData = {};
        Object.keys(data).sort().forEach(function(key) {
            orderedData[key] = data[key];
        });

        //Concatenate all the keys together, followed by all the values delimited by colon (key:key:key:key:value:value:value:value)
        let keys = [];
        let values = [];
        for (let key in orderedData) {
            keys.push(key);
            values.push(orderedData[key].toString().replace(/:/g,'\\:'))
        }
        let signingString = keys.concat(values).join(":");

        // calculate HMAC string and encode in base64
        return crypto.createHmac('sha256', new Buffer(hmacKey, 'hex')).update(signingString, 'utf-8').digest('base64');
    },

    additionalPaymentsBuildParameters: function(formFields, merchantSignature) {
        let params = {
            paymentAmount      : formFields.paymentAmount,
            currencyCode       : configSmartPay.configs.currencyCode,
            shipBeforeDate     : formFields.shipBeforeDate,
            merchantReference  : formFields.merchantReference,
            skinCode           : configSmartPay.configs.skinCode,
            merchantAccount    : configSmartPay.configs.merchantAccount,
            sessionValidity    : formFields.sessionValidity,
            shopperEmail       : formFields.shopperEmail || '',
            shopperReference   : formFields.shopperReference || '',
            recurringContract  : formFields.recurringContract || '',
            allowedMethods     : formFields.allowedMethods,
            blockedMethods     : '',
            shopperStatement   : '',
            billingAddressType : '',
            skipSelection      : ((formFields.allowedMethods !== '') ? 'true' : ''),
            orderData          : formFields.orderData,
            merchantReturnData : formFields.merchantReturnData,
            resURL             : configSmartPay.configs.additionalPaymentsReturnURL,
            merchantSig        : merchantSignature
        };

        return params;
    }

};
