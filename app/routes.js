const GovPay = require('../lib/helper');
const request = require('request');
const EmailService =require('./../lib/EmailService')

module.exports = function(router, configGovPay, app) {

    // =====================================
    // SESSION EXPIRED
    // =====================================
    router

        .get('/session-expired', function(req, res) {
            let startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl;
            return res.render('session-expired', {
                startNewApplicationUrl:startNewApplicationUrl
            })
        });

    // =====================================
    // HEALTHCHECK
    // =====================================
    router

        // healthcheck
        .get('/healthcheck', function(req, res) {
            res.json({message: 'Payment Service is running'});
        });

    // =====================================
    // ERROR - PAYMENTS
    // =====================================
    router

        //error handling
        .get('/payment-error', function(req,res) {
            let startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl;
            return res.render('payment-error', {
                errorMessage:'',
                startNewApplicationUrl:startNewApplicationUrl
            })
        });

    // =====================================
    // ERROR - ADDITIONAL PAYMENTS
    // =====================================
    router

        //error handling
        .get('/additional-payment-error', function(req,res) {
            let startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl + '/additional-payments';
            return res.render('additional-payment-error', {
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

    function isReturnDataValidForSubmitAdditionalPayment(returnData) {
        return (
            returnData &&
            returnData._links &&
            returnData._links.next_url &&
            returnData._links.next_url.href &&
            returnData.payment_id &&
            returnData.reference &&
            returnData.amount &&
            returnData.created_date &&
            returnData.state &&
            returnData.state.status
        );
    }

    function submitAdditionalPayment(req, res) {
        let startNewApplicationUrl =
            configGovPay.configs.startNewApplicationUrl + "/additional-payments";

        try {
            let moment = require("moment");
            let sess = req.session;
            let casebookRef = sess.additionalPayments.casebookRef;

            // build required data
            let formFields = {};
            formFields = GovPay.additionalPaymentsAddBaseData(
                formFields,
                casebookRef,
                sess.additionalPayments.cost,
                sess.additionalPayments.email
            );

            request.post(
                {
                    headers: {
                        "content-type": "application/json; charset=utf-8",
                        Authorization: "Bearer " + configGovPay.configs.ukPayApiKey,
                    },
                    url: configGovPay.configs.ukPayUrl,
                    body: JSON.stringify(formFields),
                },
                function (error, response) {
                    if (error) {
                        console.log(JSON.stringify(error));
                        return res.render("additional-payment-error", {
                            errorMessage: "Problem with Gov Pay response",
                            startNewApplicationUrl: startNewApplicationUrl,
                        });
                    } else {
                        let returnData;
                        try {
                            returnData = JSON.parse(response.body);
                        } catch (err) {
                            console.log(err);
                            return res.render("additional-payment-error", {
                                errorMessage: "Invalid Gov Pay return data",
                                startNewApplicationUrl: startNewApplicationUrl,
                            });
                        }

                        if (!isReturnDataValidForSubmitAdditionalPayment(returnData)) {
                            return res.render("additional-payment-error", {
                                errorMessage: "Invalid Gov Pay return data",
                                startNewApplicationUrl: startNewApplicationUrl,
                            });
                        }

                        let next_url = returnData._links.next_url.href;
                        sess.additionalPayments.paymentReference = returnData.payment_id;

                        if (casebookRef) {
                            let AdditionalPaymentDetails = require("../models/index")
                                .AdditionalPaymentDetails;
                            AdditionalPaymentDetails.findOne({
                                where: {
                                    application_id: returnData.reference,
                                },
                            }).then(function (additionalPayment) {
                                if (!additionalPayment) {
                                    AdditionalPaymentDetails.create({
                                        application_id: returnData.reference,
                                        payment_reference: returnData.payment_id,
                                        payment_amount: returnData.amount / 100,
                                        payment_status: returnData.state.status,
                                        payment_complete: false,
                                        created_at: moment(returnData.created_date).format(
                                            "DD MMMM YYYY, h:mm:ss A"
                                        ),
                                        submitted: "draft",
                                    });
                                }
                            });
                        }

                        res.render("additionalPayments/submit-additional-payment", {
                            cost: sess.additionalPayments.cost,
                            next_url: next_url,
                            startNewApplicationUrl: startNewApplicationUrl,
                        });
                    }
                }
            );
        } catch (err) {
            console.log(err);
            return res.render("additional-payment-error", {
                errorMessage: err,
                startNewApplicationUrl: startNewApplicationUrl,
            });
        }
    }


    router
        // additional payment confirmation on return from Gov Pay
        .get('/additional-payment-confirmation', function(req, res) {
            processAdditionalPayment(req,res)
        });

    function isReturnDataValidForProcessAdditionalPayment(returnData) {
        return (
            returnData &&
            returnData.amount &&
            returnData.state &&
            returnData.state.status &&
            returnData.state.finished &&
            returnData.reference &&
            returnData.created_date
        );
    }

    function isReturnDataValidForUnsuccessfulAdditionalPayment(returnData) {
        return (
            returnData &&
            returnData._links &&
            returnData._links.next_url &&
            returnData._links.next_url.href &&
            returnData.payment_id
        );
    }

    function processAdditionalPayment(req,res){

        try {
            let moment = require('moment')
            let sess = req.session
            let isSessionValid = (typeof sess.additionalPayments.cost !== 'undefined');
            let payment_id = sess.additionalPayments.paymentReference
            let startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl + '/additional-payments';

            request.get({
                headers: {
                    "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey
                },
                url: configGovPay.configs.ukPayUrl + payment_id,
            }, function (error, response, body) {
                if (error) {
                    console.log(error);
                    return res.render('additional-payment-error', {
                        errorMessage:"Payment system error",
                        startNewApplicationUrl:startNewApplicationUrl
                    })
                }
                let returnData;
                try {
                    returnData = JSON.parse(body);
                } catch (err) {
                    console.log(err);
                    return res.render("additional-payment-error", {
                        errorMessage: "Problem with Gov Pay response",
                        startNewApplicationUrl: startNewApplicationUrl,
                    });
                }

                if (!isReturnDataValidForProcessAdditionalPayment(returnData)) {
                    return res.render("additional-payment-error", {
                        errorMessage: "Invalid Gov Pay return data",
                        startNewApplicationUrl: startNewApplicationUrl,
                    });
                }
                let cost = returnData.amount / 100
                let status = returnData.state?.status
                let finished = returnData.state?.finished
                let appReference = returnData.reference
                let paymentMethod = returnData.card_details?.card_brand
                let createdDate = moment(returnData.created_date).format('DD MMMM YYYY, h:mm:ss A')

                if (status && status === 'success' && finished && finished === true){

                    console.log(payment_id + ' - payment is successful');

                    if (isSessionValid) {

                        EmailService.additionalPaymentReceipt(
                            sess.additionalPayments.email,
                            createdDate,
                            appReference,
                            'Get Document Legalised – Additional Payments',
                            sess.additionalPayments.cost,
                            paymentMethod
                        )

                        let casebookRef = sess.additionalPayments.casebookRef
                        if (casebookRef) {
                            let AdditionalPaymentDetails = require('../models/index').AdditionalPaymentDetails;
                            AdditionalPaymentDetails.update({
                                payment_status: 'AUTHORISED',
                                payment_reference: payment_id,
                                payment_amount: cost,
                                payment_complete: true,
                                updated_at: moment().format('DD MMMM YYYY, h:mm:ss A'),
                                submitted: 'queued'
                            }, {
                                where:{
                                    application_id: returnData.reference
                                }
                            })
                        }
                    }

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
                    formFields = GovPay.additionalPaymentsAddBaseData(formFields, sess.additionalPayments.casebookRef, sess.additionalPayments.cost, sess.additionalPayments.email);

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
                            let returnData;
                            try {
                                returnData = JSON.parse(response.body);
                            } catch (err) {
                                console.log(err);
                                return res.render("additional-payment-error", {
                                    errorMessage: "Problem with Gov Pay response",
                                    startNewApplicationUrl: startNewApplicationUrl,
                                });
                            }
                            if (!isReturnDataValidForUnsuccessfulAdditionalPayment(returnData)) {
                                return res.render("additional-payment-error", {
                                    errorMessage: "Invalid Gov Pay return data",
                                    startNewApplicationUrl: startNewApplicationUrl,
                                });
                            }
                            let next_url = returnData._links.next_url?.href
                            sess.additionalPayments.paymentReference = returnData.payment_id

                            res.render('additionalPayments/additional-payment-confirmation', {
                                isSessionValid:isSessionValid,
                                paymentSuccessful:false,
                                cost:sess.cost,
                                next_url: next_url,
                                startNewApplicationUrl:startNewApplicationUrl
                            });

                        }

                    })

                }

        })

        }catch (err) {
            let startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl + '/additional-payments';
            console.log(err);
            return res.render('additional-payment-error', {
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

    function isReturnDataValidForSubmitPayment(returnData) {
        return (
            returnData &&
            returnData._links &&
            returnData._links.next_url &&
            returnData._links.next_url.href &&
            returnData.payment_id
        );
    }

    function submitPayment(req,res){

        // get the application ID from the request (redirected from application service)
        var appid = req.session.appId;
        var startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl;

        if( req.session.appId && req.session.appId !==0 ){
            //Do nothing
        }
        else{

            res.clearCookie('LoggedIn');
            req.session.appId = false;
            return res.render('payment-error', {
                errorMessage:'Missing user session',
                startNewApplicationUrl:startNewApplicationUrl
            })
        }
        var loggedIn = GovPay.loggedInStatus(req);
        var usersEmail = (loggedIn) ? GovPay.loggedInUserEmail(req) : GovPay.loggedOutUserEmail(req)

        // get the relevant database models
        var ApplicationPaymentDetails = require('../models/index').ApplicationPaymentDetails;
        var Application = require('../models/index').Application;
        var UserDetails = require('../models/index').UserDetails;
        var UserDocumentCount = require('../models/index').UserDocumentCount;

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
                                let returnData;
                                try {
                                    returnData = JSON.parse(response.body);
                                } catch (err) {
                                    console.log(err);
                                    return res.render("payment-error", {
                                        errorMessage: "Problem with Gov Pay response",
                                        startNewApplicationUrl: startNewApplicationUrl,
                                    });
                                }
                                if (!isReturnDataValidForSubmitPayment(returnData)) {
                                    return res.render("payment-error", {
                                        errorMessage: "Invalid Gov Pay return data",
                                        startNewApplicationUrl: startNewApplicationUrl,
                                    });
                                }
                                let next_url = returnData._links.next_url.href

                                // update database (add payment reference)
                                ApplicationPaymentDetails.update({
                                    payment_reference : returnData.payment_id
                                },{
                                    where: {
                                        application_id: appid
                                    }
                                }).then( function() {
                                    //redirect to next form page with parameters
                                    return res.redirect(next_url);

                                }).catch(function (error) {
                                    console.log(appid + ' - ' + error);
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

    function isReturnDataValidForPaymentConfirmation(returnData) {
        return (
            returnData &&
            returnData.state &&
            returnData.state.status &&
            returnData.state.finished &&
            returnData.reference
        );
    }

    function isReturnDataValidForUnsuccessfulPaymentConfirmation(returnData) {
        return (
            returnData &&
            returnData._links &&
            returnData._links.next_url &&
            returnData._links.next_url.href &&
            returnData.payment_id
        );
    }

    router

        // prepare confirmation page
        .get('/payment-confirmation', function(req, res) {

            var appIdFromGovPay = req.query.id
            var startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl

            // get appId from the session
            // else send user to error page
            var appId = req.session.appId;
            if (req.session.appId && req.session.appId !==0) {
                //Do nothing
            }
            else{
                console.log(appIdFromGovPay + ' - Application has missing session. Rendering error page.')
                res.clearCookie('LoggedIn');
                req.session.appId = false;
                return res.render('payment-error', {
                    errorMessage:'Missing user session',
                    startNewApplicationUrl:startNewApplicationUrl
                })
            }

            // get the relevant database models
            var ApplicationPaymentDetails = require('../models/index').ApplicationPaymentDetails;
            var Application = require('../models/index').Application;
            var UserDetails = require('../models/index').UserDetails;
            var UserDocumentCount = require('../models/index').UserDocumentCount;


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
                    if (error) {
                        console.log(appId + ' - ' + error);
                        return res.render('payment-error', {
                            errorMessage:'Payment system error',
                            startNewApplicationUrl:startNewApplicationUrl
                        })
                    }
                    let returnData;
                    try {
                        returnData = JSON.parse(body);
                    } catch (err) {
                        console.log(err);
                        return res.render("payment-error", {
                            errorMessage: "Problem with Gov Pay response",
                            startNewApplicationUrl: startNewApplicationUrl,
                        });
                    }
                    if (!isReturnDataValidForPaymentConfirmation(returnData)) {
                        return res.render("payment-error", {
                            errorMessage: "Invalid Gov Pay return data",
                            startNewApplicationUrl: startNewApplicationUrl,
                        });
                    }
                    let status = returnData.state.status
                    let finished = returnData.state.finished
                    let appReference = returnData.reference

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
                                                        let returnData;
                                                        try {
                                                            returnData = JSON.parse(response.body);
                                                        } catch (err) {
                                                            console.log(err);
                                                            return res.render("payment-error", {
                                                                errorMessage: "Problem with Gov Pay response",
                                                                startNewApplicationUrl: startNewApplicationUrl,
                                                            });
                                                        }
                                                        if (!isReturnDataValidForUnsuccessfulPaymentConfirmation(returnData)) {
                                                            return res.render("payment-error", {
                                                                errorMessage: "Invalid Gov Pay return data",
                                                                startNewApplicationUrl: startNewApplicationUrl,
                                                            });
                                                        }
                                                        let next_url = returnData._links.next_url.href

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
                                                                        loggedIn: loggedIn,
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
