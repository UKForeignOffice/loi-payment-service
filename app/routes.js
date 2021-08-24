
var GovPay = require('../lib/helper');
var request = require('request');
var EmailService =require('./../lib/EmailService')

module.exports = function(router, configGovPay, app) {

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
            let startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl + '/additional-payments';
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

        let startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl + '/additional-payments';

        try {
            let sess = req.session;
            // build required data
            let formFields = {};
            formFields = GovPay.additionalPaymentsAddBaseData(formFields, sess.additionalPayments.cost, sess.additionalPayments.email);

            request.post({
                headers: {
                    "content-type": "application/json; charset=utf-8",
                    "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey
                },
                url: configGovPay.configs.ukPayUrl,
                body: JSON.stringify(formFields)
            }, function (error, response) {
                if (error) {
                    console.log(JSON.stringify(error));
                } else {
                    var returnData = JSON.parse(response.body)
                    var next_url = returnData._links.next_url.href
                    sess.additionalPayments.paymentReference = returnData.payment_id

                    res.render('additionalPayments/submit-additional-payment', {
                        cost:sess.additionalPayments.cost,
                        next_url: next_url,
                        startNewApplicationUrl:startNewApplicationUrl
                    })

                }

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
            let payment_id = sess.additionalPayments.paymentReference
            let startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl + '/additional-payments';

            request.get({
                headers: {
                    "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey
                },
                url: configGovPay.configs.ukPayUrl + payment_id,
            }, function (error, response, body) {
                let returnData = JSON.parse(body)
                let status = returnData.state.status
                let finished = returnData.state.finished
                let appReference = returnData.reference
                let paymentMethod = returnData.card_details.card_brand
                let createdDate = moment(returnData.created_date).format('DD MMMM YYYY, h:mm:ss A')


                if (status && status === 'success' && finished && finished === true){

                    console.log(payment_id + ' - payment is successful');
                    EmailService.additionalPaymentReceipt(
                        sess.additionalPayments.email,
                        createdDate,
                        appReference,
                        'Get Document Legalised – Additional Payments',
                        sess.additionalPayments.cost,
                        paymentMethod
                    )

                    res.render('additionalPayments/additional-payment-confirmation', {
                        req:req,
                        isSessionValid:isSessionValid,
                        paymentSuccessful:true,
                        appReference:appReference,
                        createdDate:createdDate,
                        paymentMethod:paymentMethod,
                        cost:sess.additionalPayments.cost,
                        email:sess.additionalPayments.email,
                        startNewApplicationUrl:startNewApplicationUrl
                    });

                } else {

                    console.log(payment_id + ' - payment is NOT successful');
                    let formFields = {};
                    formFields = GovPay.additionalPaymentsAddBaseData(formFields, sess.additionalPayments.cost, sess.additionalPayments.email);

                    request.post({
                        headers: {
                            "content-type": "application/json; charset=utf-8",
                            "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey
                        },
                        url: configGovPay.configs.ukPayUrl,
                        body: JSON.stringify(formFields)
                    }, function (error, response) {
                        if (error) {
                            console.log(JSON.stringify(error));
                        } else {
                            var returnData = JSON.parse(response.body)
                            var next_url = returnData._links.next_url.href
                            sess.additionalPayments.paymentReference = returnData.payment_id

                            res.render('additionalPayments/additional-payment-confirmation', {
                                isSessionValid:isSessionValid,
                                paymentSuccessful:false,
                                cost:sess.cost,
                                next_url: next_url
                            });

                        }

                    })

                }

        })

        }catch (err) {
            let startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl + '/additional-payments';
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
        var loggedIn = GovPay.loggedInStatus(req);
        var usersEmail = (loggedIn) ? GovPay.loggedInUserEmail(req) : GovPay.loggedOutUserEmail(req)

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

                        formFields = GovPay.buildUkPayData(formFields, applicationDetail, application, usersEmail);

                        request.post({
                            headers: {
                                "content-type": "application/json; charset=utf-8",
                                "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey
                            },
                            url: configGovPay.configs.ukPayUrl,
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
                        "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey
                    },
                    url: configGovPay.configs.ukPayUrl + payment_id,
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
                            res.redirect(configGovPay.configs.applicationServiceReturnUrl + '?id=' + appId + '&appReference=' + appReference);
                        }).catch(function (error) {
                            console.log(appId + ' - ' + error);
                        });

                    } else {

                        console.log(appId + ' - payment is NOT successful');
                        var loggedIn = GovPay.loggedInStatus(req);
                        var usersEmail = (loggedIn) ? GovPay.loggedInUserEmail(req) : GovPay.loggedOutUserEmail(req)
                        var isSessionValid = GovPay.isSessionValid(req);

                                // lookup required data from database
                                var formFieldsTemp = Application.findOne({ where: {application_id: appId}}).then(function(application) {

                                    ApplicationPaymentDetails.findOne({where: {application_id: appId}}).then(function (applicationDetail) {

                                        UserDetails.findOne({where: {application_id: appId}}).then(function (userDetails) {

                                            UserDocumentCount.findOne({where: {application_id: appId}}).then(function (userDocumentCount) {

                                                // array to hold data for sending to Payment API
                                                var formFields = {};

                                                formFields = GovPay.buildUkPayData(formFields, applicationDetail, application, usersEmail);

                                                request.post({
                                                    headers: {
                                                        "content-type": "application/json; charset=utf-8",
                                                        "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey
                                                    },
                                                    url: configGovPay.configs.ukPayUrl,
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
                                                                    startNewApplicationUrl: configGovPay.configs.startNewApplicationUrl,
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

