
var SmartPay = require('./../lib/smartpay-functions');
var request = require('request');

module.exports = function(router, configSmartPay, app) {

    // =====================================
    // HEALTHCHECK
    // =====================================
    router

        // healthcheck
        .get('/healthcheck', function(req, res) {
            res.json({message: 'Payment Service is running'});
        });

    // =====================================
    // ERROR
    // =====================================
    router

        //error handling
        .get('/error', function(req,res) {
            return res.view('error.ejs')
        });


    // ===============================
    // ADDITIONAL PAYMENTS
    // ===============================
    router
        // process additional payments
        .post('/submit-additional-payment', function (req, res) {
            submitAdditionalPayment(req, res)
        });

    function submitAdditionalPayment(req,res){

        try {
            let sess = req.session;
            // build smart pay required data
            let formFields = {};
            formFields = SmartPay.additionalPaymentsAddBaseData(formFields, sess.additionalPayments.cost, sess.additionalPayments.email);
            formFields = SmartPay.addDateFields(formFields);
            formFields = SmartPay.compressAndEncodeOrderData(formFields);
            let merchantSignature = SmartPay.additionalPaymentsCalculateMerchantSignature(formFields);
            let requestParameters = SmartPay.additionalPaymentsBuildParameters(formFields, merchantSignature);

            res.render('additionalPayments/submit-additional-payment', {
                cost:sess.additionalPayments.cost,
                params:requestParameters,
                smartPayUrl: configSmartPay.configs.smartPayUrl
            })
        } catch (err) {
            let startNewApplicationUrl = configSmartPay.configs.startNewApplicationUrl + '/additional-payments';
            console.log(err);
            return res.render('error', {
                errorMessage:err,
                startNewApplicationUrl:startNewApplicationUrl
            })
        }
    }

    router
        // additional payment confirmation on return from Barclaycard
        .get('/additional-payment-confirmation', function(req, res) {
            processAdditionalPayment(req,res)
        });

    function processAdditionalPayment(req,res){

        try {
            let moment = require('moment');

            let sess = req.session;
            let isSessionValid = (typeof sess.additionalPayments.cost !== 'undefined');

            // decode query string parameters to verify signature (HMAC)
            let returnDataIsValid = SmartPay.decodeReturnedMerchantSignature(req.query);
            let paymentSuccessful = (req.query.authResult === "AUTHORISED");
            let startNewApplicationUrl = configSmartPay.configs.startNewApplicationUrl + '/additional-payments';
            req.query.paymentMethod = SmartPay.lookupPaymentMethod(req.query.paymentMethod);
            req.query.merchantReference = moment.unix(Number(req.query.merchantReference)).format('DD MMMM YYYY, h:mm:ss A')

            if (paymentSuccessful && returnDataIsValid) {
                res.render('additionalPayments/additional-payment-confirmation', {
                    isSessionValid:isSessionValid,
                    paymentSuccessful:paymentSuccessful,
                    params:req.query,
                    cost:sess.additionalPayments.cost,
                    email:sess.additionalPayments.email,
                    startNewApplicationUrl:startNewApplicationUrl
                });
            } else {

                // build smart pay required data....again
                let formFields = {};
                formFields = SmartPay.additionalPaymentsAddBaseData(formFields, sess.additionalPayments.cost, sess.additionalPayments.email);
                formFields = SmartPay.addDateFields(formFields);
                formFields = SmartPay.compressAndEncodeOrderData(formFields);
                let merchantSignature = SmartPay.additionalPaymentsCalculateMerchantSignature(formFields);
                let requestParameters = SmartPay.additionalPaymentsBuildParameters(formFields, merchantSignature);

                res.render('additionalPayments/additional-payment-confirmation', {
                    isSessionValid:isSessionValid,
                    paymentSuccessful:false,
                    cost:sess.cost,
                    params:requestParameters,
                    smartPayUrl: configSmartPay.configs.smartPayUrl
                });
            }
        } catch (err) {
            let startNewApplicationUrl = configSmartPay.configs.startNewApplicationUrl + '/additional-payments';
            console.log(err);
            return res.render('error', {
                errorMessage:err,
                startNewApplicationUrl:startNewApplicationUrl
            })
        }
    }



    // =====================================
    // SEND PAYMENT
    // =====================================
    router
        // redirect to Barclaycard to process payment
        .get('/submit-payment', function(req,res){submitPayment(req,res);})
        .post('/submit-payment', function(req,res){submitPayment(req,res);});


    function submitPayment(req,res){

        // get the application ID from the request (redirected from application service)
        var appid = req.session.appId;
        if(req.session.appId && req.session.appId !==0 ){
            //Do nothing
        }
        else{

            res.clearCookie('LoggedIn');
            req.session.appId = false;
            return res.redirect('/session-expired?LoggedIn=false');
        }
        var loggedIn = SmartPay.loggedInStatus(req);
        var usersEmail = SmartPay.loggedInUserEmail(req);

        // get the relevant database models
        var ApplicationPaymentDetails = app.get('models').ApplicationPaymentDetails;
        var Application = app.get('models').Application;
        var UserDetails = app.get('models').UserDetails;
        var UserDocumentCount = app.get('models').UserDocumentCount;

        // lookup required data from database
        var formFieldsTemp = Application.findOne({ where: {application_id: appid}}).then(function(application){

            ApplicationPaymentDetails.findOne({ where: {application_id: appid }}).then(function(applicationDetail){

                UserDetails.findOne({ where: {application_id: appid}}).then(function(userDetails){

                    UserDocumentCount.findOne({ where: {application_id: appid}}).then(function(userDocumentCount) {

                        // array to hold data for encoding and sending to SmartPay API
                        var formFields = {};

                        // add base application data
                        formFields = SmartPay.addApplicationData(appid, formFields, applicationDetail, application, userDocumentCount, loggedIn);

                        // add calculated date fields for session expiry and shipping date
                        formFields = SmartPay.addDateFields(formFields);

                        // add required data for saving card details
                        formFields = SmartPay.addOneClickFields(appid, formFields, userDetails, applicationDetail);

                        // compress and encode order data
                        formFields = SmartPay.compressAndEncodeOrderData(formFields);

                        //calculate merchant signature
                        var merchantSig = SmartPay.calculateMerchantSignature(formFields);

                        //create array of parameters
                        var requestParameters = SmartPay.buildParameters(formFields, merchantSig);

                        //redirect to next form page with parameters
                        res.render('submit-payment.ejs', {
                            params: requestParameters,
                            applicationId: appid,
                            applicationType: application.serviceType,
                            loggedIn: loggedIn,
                            usersEmail: usersEmail,
                            smartPayUrl: configSmartPay.configs.smartPayUrl,
                            user_data: {
                                loggedIn: req.session && req.session.passport && req.session.passport.user,
                                user: req.session.user,
                                account: req.session.account,
                                url: '/api/user/'
                            }
                        });

                    });
                });
            });
        });
    }

    // =====================================
    // PAYMENT CONFIRMATION
    // =====================================

    router

        // prepare confirmation page
        .get('/payment-confirmation', function(req, res) {

            // get the relevant database models
            var ApplicationPaymentDetails = app.get('models').ApplicationPaymentDetails;

            // application ID will be in the database (use merchantReference to lookup)
            var appId = req.query.merchantReturnData;
            var loggedIn = SmartPay.loggedInStatus(req);
            var usersEmail = SmartPay.loggedInUserEmail(req);

            // decode query string parameters to verify signature (HMAC)
            var returnDataIsValid = SmartPay.decodeReturnedMerchantSignature(req.query);

            // update database (add payment reference, mark payment as authorised)
            ApplicationPaymentDetails.update({
                payment_complete  : true,
                payment_reference : req.query.pspReference,
                payment_status    : req.query.authResult
            },{
                where: {
                    application_id: appId
                }
            }).then( function() {

                // check if payment was successful
                var paymentSuccessful = (req.query.authResult == "AUTHORISED");

                // check the payment was successful and that the data has not been tampered with (validated against HMAC)
                if (paymentSuccessful && returnDataIsValid) {

                    console.log(appId + ' - payment is successful');

                    var originalQueryString = req.query;

                    function buildQueryString (done) {
                        console.log(appId + ' - constructing query string for application service');
                        var queryString = '?' +
                            Object.keys(originalQueryString).map(function (key) {
                                return encodeURIComponent(key) + '=' +
                                    encodeURIComponent(originalQueryString[key]);
                            }).join('&');
                        done(queryString);
                    }

                    // rebuild query string from JSON to pass to app service URL then
                    // redirect to application confirmation page
                    buildQueryString(function (queryString) {
                        console.log(appId + ' - redirecting to application service');
                        res.redirect(configSmartPay.configs.applicationServiceReturnUrl + queryString);
                    });

                }
                else {

                    console.log(appId + ' - payment is NOT successful');

                    // build data to pass to failed payment page (for resubmission)

                    // get the application ID from the request (redirected from application service)
                    var appid = req.query.merchantReturnData;
                    var loggedIn = SmartPay.loggedInStatus(req);
                    var usersEmail = SmartPay.loggedInUserEmail(req);
                    var isSessionValid = SmartPay.isSessionValid(req);

                    // get the relevant database models
                    var ApplicationPaymentDetails = app.get('models').ApplicationPaymentDetails;
                    var Application = app.get('models').Application;
                    var UserDetails = app.get('models').UserDetails;
                    var UserDocumentCount = app.get('models').UserDocumentCount;

                    // lookup required data from database
                    var formFieldsTemp = Application.findOne({ where: {application_id: appid}}).then(function(application) {

                        ApplicationPaymentDetails.findOne({where: {application_id: appid}}).then(function (applicationDetail) {

                            UserDetails.findOne({where: {application_id: appid}}).then(function (userDetails) {

                                UserDocumentCount.findOne({where: {application_id: appid}}).then(function (userDocumentCount) {

                                    // array to hold data for encoding and sending to SmartPay API
                                    var formFields = {};

                                    // add base application data
                                    formFields = SmartPay.addApplicationData(appid, formFields, applicationDetail, application, userDocumentCount, loggedIn);

                                    // add calculated date fields for session expiry and shipping date
                                    formFields = SmartPay.addDateFields(formFields);

                                    // add required data for saving card details
                                    formFields = SmartPay.addOneClickFields(appid, formFields, userDetails, applicationDetail);

                                    // compress and encode order data
                                    formFields = SmartPay.compressAndEncodeOrderData(formFields);

                                    //calculate merchant signature
                                    var merchantSig = SmartPay.calculateMerchantSignature(formFields);

                                    //create array of parameters
                                    var requestParameters = SmartPay.buildParameters(formFields, merchantSig);

                                    console.log(appId + ' - rendering failed payment page');
                                    // display failed payment page (with link to start a new payment)
                                    res.render('payment-confirmation.ejs',
                                        {
                                            params: requestParameters,
                                            applicationId: appid,
                                            applicationType: application.serviceType,
                                            smartPayUrl: configSmartPay.configs.smartPayUrl,
                                            startNewApplicationUrl: configSmartPay.configs.startNewApplicationUrl,
                                            loggedIn: loggedIn,
                                            isSessionValid: isSessionValid,
                                            usersEmail: usersEmail,
                                            user_data: {
                                                loggedIn: req.session && req.session.passport && req.session.passport.user,
                                                user: req.session.user,
                                                account: req.session.account,
                                                url: '/api/user/'
                                            }
                                        });
                                });
                            });
                        });
                    });
                }

            }).catch(function (error) {
                console.log(appId + ' - ' + error);
            });

        });
};

