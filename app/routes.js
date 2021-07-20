
var SmartPay = require('./../lib/smartpay-functions');
var request = require('request');
var EmailService =require('./../lib/EmailService')

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
            let startNewApplicationUrl = configSmartPay.configs.startNewApplicationUrl + '/additional-payments';
            return res.render('error', {
                errorMessage:'',
                startNewApplicationUrl:startNewApplicationUrl
            })
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

        let startNewApplicationUrl = configSmartPay.configs.startNewApplicationUrl + '/additional-payments';

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
                smartPayUrl: configSmartPay.configs.smartPayUrl,
                startNewApplicationUrl:startNewApplicationUrl
            })
        } catch (err) {
            console.log(err);
            return res.render('error', {
                errorMessage:err,
                startNewApplicationUrl:startNewApplicationUrl
            })
        }
    }

    router
        // additional payment confirmation on return from Gov Pay
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
                EmailService.additionalPaymentReceipt(
                    sess.additionalPayments.email,
                    moment().format("DD/MM/YYYY"),
                    req.query.pspReference,
                    'Get Document Legalised – Additional Payments',
                    sess.additionalPayments.cost,
                    req.query.paymentMethod
                    )
                res.render('additionalPayments/additional-payment-confirmation', {
                    req:req,
                    isSessionValid:isSessionValid,
                    paymentSuccessful:paymentSuccessful,
                    params:req.query,
                    cost:sess.additionalPayments.cost,
                    email:sess.additionalPayments.email,
                    startNewApplicationUrl:startNewApplicationUrl
                });
            } else {


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
        // redirect to Gov Pay to process payment
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
        Application.findOne({ where: {application_id: appid}}).then(function(application){

            ApplicationPaymentDetails.findOne({ where: {application_id: appid }}).then(function(applicationDetail){

                UserDetails.findOne({ where: {application_id: appid}}).then(function(userDetails){

                    UserDocumentCount.findOne({ where: {application_id: appid}}).then(function(userDocumentCount) {

                        // array to hold data for sending to Payment API
                        var formFields = {};

                        formFields = SmartPay.buildUkPayData(formFields, applicationDetail, application, usersEmail);

                        request.post({
                            headers: {
                                "content-type": "application/json; charset=utf-8",
                                "Authorization": "Bearer " + configSmartPay.configs.ukPayApiKey
                            },
                            url: configSmartPay.configs.ukPayUrl,
                            body: JSON.stringify(formFields)
                        }, function (error, response) {
                            if (error) {
                                console.log(JSON.stringify(error));
                            } else {
                                var returnData = JSON.parse(response.body)
                                var next_url = returnData._links.next_url.href


                                // update database (add payment reference)
                                ApplicationPaymentDetails.update({
                                    payment_reference : returnData.payment_id
                                },{
                                    where: {
                                        application_id: appid
                                    }
                                }).then( function() {
                                    //redirect to next form page with parameters
                                    res.render('submit-payment.ejs', {
                                        applicationId: appid,
                                        applicationType: application.serviceType,
                                        loggedIn: loggedIn,
                                        usersEmail: usersEmail,
                                        next_url: next_url,
                                        user_data: {
                                            loggedIn: req.session && req.session.passport && req.session.passport.user,
                                            user: req.session.user,
                                            account: req.session.account,
                                            url: '/api/user/'
                                        }
                                    });

                                }).catch(function (error) {
                                    console.log(appId + ' - ' + error);
                                });

                            }

                        })

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

            // get appId from the session
            var appId = req.session.appId;

            // get the relevant database models
            var ApplicationPaymentDetails = app.get('models').ApplicationPaymentDetails;
            var Application = app.get('models').Application;
            var UserDetails = app.get('models').UserDetails;
            var UserDocumentCount = app.get('models').UserDocumentCount;

            // check the payment id from the database
            ApplicationPaymentDetails.findOne({
                    where: {
                        application_id: appId
                    }
                }
            ).then(function (results) {
                var payment_id = results.payment_reference

                request.get({
                    headers: {
                        "Authorization": "Bearer " + configSmartPay.configs.ukPayApiKey
                    },
                    url: configSmartPay.configs.ukPayUrl + payment_id,
                }, function (error, response, body) {
                    var returnData = JSON.parse(body)
                    var status = returnData.state.status
                    var finished = returnData.state.finished
                    var appReference = returnData.reference

                    if (status && status === 'success' && finished && finished === true){

                        ApplicationPaymentDetails.update({
                            payment_complete: true,
                            payment_status: 'AUTHORISED'
                        }, {
                            where: {
                                application_id: appId
                            }
                        }).then(function() {
                            console.log(appId + ' - payment is successful');
                            res.redirect(configSmartPay.configs.applicationServiceReturnUrl + '?id=' + appId + '&appReference=' + appReference);
                        }).catch(function (error) {
                            console.log(appId + ' - ' + error);
                        });

                    } else {

                        console.log(appId + ' - payment is NOT successful');
                        var loggedIn = SmartPay.loggedInStatus(req);
                        var usersEmail = SmartPay.loggedInUserEmail(req);
                        var isSessionValid = SmartPay.isSessionValid(req);

                                // lookup required data from database
                                var formFieldsTemp = Application.findOne({ where: {application_id: appId}}).then(function(application) {

                                    ApplicationPaymentDetails.findOne({where: {application_id: appId}}).then(function (applicationDetail) {

                                        UserDetails.findOne({where: {application_id: appId}}).then(function (userDetails) {

                                            UserDocumentCount.findOne({where: {application_id: appId}}).then(function (userDocumentCount) {

                                                // array to hold data for sending to Payment API
                                                var formFields = {};

                                                formFields = SmartPay.buildUkPayData(formFields, applicationDetail, application, usersEmail);

                                                request.post({
                                                    headers: {
                                                        "content-type": "application/json; charset=utf-8",
                                                        "Authorization": "Bearer " + configSmartPay.configs.ukPayApiKey
                                                    },
                                                    url: configSmartPay.configs.ukPayUrl,
                                                    body: JSON.stringify(formFields)
                                                }, function (error, response) {
                                                    if (error) {
                                                        console.log(JSON.stringify(error));
                                                    } else {
                                                        var returnData = JSON.parse(response.body)
                                                        var next_url = returnData._links.next_url.href


                                                        // update database (add payment reference)
                                                        ApplicationPaymentDetails.update({
                                                            payment_reference : returnData.payment_id
                                                        },{
                                                            where: {
                                                                application_id: appId
                                                            }
                                                        }).then( function() {
                                                            console.log(appId + ' - rendering failed payment page');
                                                            // display failed payment page (with link to start a new payment)

                                                            res.render('payment-confirmation.ejs',
                                                                {
                                                                    applicationId: appId,
                                                                    applicationType: application.serviceType,
                                                                    next_url: next_url,
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

                                                        }).catch(function (error) {
                                                            console.log(appId + ' - ' + error);
                                                        });

                                                    }

                                                })

                                            }).catch(function (error) {
                                                console.log(appId + ' - ' + error);
                                            });
                                        }).catch(function (error) {
                                            console.log(appId + ' - ' + error);
                                        });
                                    }).catch(function (error) {
                                        console.log(appId + ' - ' + error);
                                    });
                                }).catch(function (error) {
                                    console.log(appId + ' - ' + error);
                                });

                    }
                });

            }).catch(function (error) {
                console.log(appId + ' - ' + error);
            });

        });
};

