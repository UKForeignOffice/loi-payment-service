const GovPay = require('../lib/helper');
const EmailService =require('./../lib/EmailService');
const axios = require('axios');
const moment = require('moment');
const AdditionalPaymentDetails = require('../models/index').AdditionalPaymentDetails;
const ApplicationPaymentDetails = require('../models/index').ApplicationPaymentDetails;
const Application = require('../models/index').Application;
const UserDetails = require('../models/index').UserDetails;
const UserDocumentCount = require('../models/index').UserDocumentCount;

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

    async function submitAdditionalPayment(req, res) {
        const startNewApplicationUrl =
            configGovPay.configs.startNewApplicationUrl + '/additional-payments';

        try {
            const sess = req.session;
            const { applicationRef, applicationAmount, applicationEmail } = sess.additionalPayments;

            // build required data
            let formFields = {};
            formFields = GovPay.additionalPaymentsAddBaseData(
                formFields,
                applicationRef,
                applicationAmount,
                applicationEmail
            );

            const response = await axios.post(configGovPay.configs.ukPayUrl, formFields, {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Authorization': `Bearer ${configGovPay.configs.ukPayApiKey}`,
                },
            });

            const returnData = response.data;

            if (!isReturnDataValidForSubmitAdditionalPayment(returnData)) {
                return res.render("additional-payment-error", {
                    errorMessage: "Invalid Gov Pay return data",
                    startNewApplicationUrl: startNewApplicationUrl,
                });
            }

            const next_url = returnData._links.next_url.href;
            sess.additionalPayments.paymentReference = returnData.payment_id;

            if (applicationRef) {
                const additionalPayment = await AdditionalPaymentDetails.findOne({
                    where: { application_id: returnData.reference }
                });

                if (!additionalPayment) {
                    await AdditionalPaymentDetails.create({
                        application_id: returnData.reference,
                        payment_reference: returnData.payment_id,
                        payment_amount: returnData.amount / 100,
                        payment_status: returnData.state.status,
                        payment_complete: false,
                        created_at: moment(returnData.created_date).format('DD MMMM YYYY, h:mm:ss A'),
                        submitted: 'draft',
                    });
                }
            }

            res.render('additionalPayments/submit-additional-payment', {
                cost: applicationAmount,
                next_url: next_url,
                startNewApplicationUrl: startNewApplicationUrl,
            });

        } catch (err) {
            console.error(err);
            res.render('additional-payment-error', {
                errorMessage: err.message || 'An error occurred',
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

    async function processAdditionalPayment(req, res) {
        const startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl + '/additional-payments';

        try {
            const sess = req.session;
            const isSessionValid = (typeof sess.additionalPayments.applicationAmount !== 'undefined');
            const payment_id = sess.additionalPayments.paymentReference;

            // Fetch payment details
            const response = await axios.get(configGovPay.configs.ukPayUrl + payment_id, {
                headers: {
                    'Authorization': `Bearer ${configGovPay.configs.ukPayApiKey}`
                }
            });

            const returnData = response.data;

            if (!isReturnDataValidForProcessAdditionalPayment(returnData)) {
                return res.render("additional-payment-error", {
                    errorMessage: "Invalid Gov Pay return data",
                    startNewApplicationUrl: startNewApplicationUrl,
                });
            }

            const cost = returnData.amount / 100;
            const { status, finished } = returnData.state;
            const appReference = returnData.reference;
            const paymentMethod = returnData.card_details?.card_brand;
            const createdDate = moment(returnData.created_date).format('DD MMMM YYYY, h:mm:ss A');

            if (status === 'success' && finished === true) {
                console.log(`${payment_id} - payment is successful`);

                if (isSessionValid) {
                    await EmailService.additionalPaymentReceipt(
                        sess.additionalPayments.applicationEmail,
                        createdDate,
                        appReference,
                        'Get Document Legalised – Additional Payments',
                        sess.additionalPayments.applicationAmount,
                        paymentMethod
                    );

                    if (sess.additionalPayments.applicationRef) {
                        await AdditionalPaymentDetails.update({
                            payment_status: 'AUTHORISED',
                            payment_reference: payment_id,
                            payment_amount: cost,
                            payment_complete: true,
                            updated_at: moment().format('DD MMMM YYYY, h:mm:ss A'),
                            submitted: 'queued'
                        }, {
                            where: { application_id: returnData.reference }
                        });
                    }
                }

                res.render('additionalPayments/additional-payment-confirmation', {
                    req,
                    isSessionValid,
                    paymentSuccessful: true,
                    appReference,
                    createdDate,
                    paymentMethod,
                    cost: sess.additionalPayments.applicationAmount,
                    email: sess.additionalPayments.applicationEmail,
                    startNewApplicationUrl
                });

            } else {
                console.log(`${payment_id} - payment is NOT successful`);

                // Handle unsuccessful payment
                const formFields = GovPay.additionalPaymentsAddBaseData({}, sess.additionalPayments.applicationRef, sess.additionalPayments.applicationAmount, sess.additionalPayments.applicationEmail);

                const retryResponse = await axios.post(configGovPay.configs.ukPayUrl, formFields, {
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Authorization': `Bearer ${configGovPay.configs.ukPayApiKey}`
                    }
                });

                const retryData = retryResponse.data;
                if (!isReturnDataValidForUnsuccessfulAdditionalPayment(retryData)) {
                    return res.render("additional-payment-error", {
                        errorMessage: "Invalid Gov Pay return data",
                        startNewApplicationUrl: startNewApplicationUrl,
                    });
                }

                sess.additionalPayments.paymentReference = retryData.payment_id;

                res.render('additionalPayments/additional-payment-confirmation', {
                    isSessionValid,
                    paymentSuccessful: false,
                    cost: sess.additionalPayments.applicationAmount,
                    next_url: retryData._links.next_url?.href,
                    startNewApplicationUrl
                });
            }
        } catch (err) {
            console.error(err);
            res.render('additional-payment-error', {
                errorMessage: err.message || 'An error occurred',
                startNewApplicationUrl
            });
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

    async function submitPayment(req, res) {
        const startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl;

        if (!req.session.appId || req.session.appId === 0) {
            await res.clearCookie('LoggedIn');
            req.session.appId = false;
            return res.render('payment-error', {
                errorMessage: 'Missing user session',
                startNewApplicationUrl: startNewApplicationUrl
            });
        }

        const loggedIn = GovPay.loggedInStatus(req);
        const usersEmail = loggedIn ? GovPay.loggedInUserEmail(req) : GovPay.loggedOutUserEmail(req);
        const appid = req.session.appId;

        try {
            const application = await Application.findOne({ where: { application_id: appid } });
            const applicationDetail = await ApplicationPaymentDetails.findOne({ where: { application_id: appid } });
            const userDetails = await UserDetails.findOne({ where: { application_id: appid } });
            const userDocumentCount = await UserDocumentCount.findOne({ where: { application_id: appid } });

            // array to hold data for sending to Payment API
            let formFields = GovPay.buildUkPayData({}, applicationDetail, application, usersEmail);

            const response = await axios.post(configGovPay.configs.ukPayUrl, formFields, {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Authorization': `Bearer ${configGovPay.configs.ukPayApiKey}`
                }
            });

            const returnData = response.data;

            if (!isReturnDataValidForSubmitPayment(returnData)) {
                return res.render("payment-error", {
                    errorMessage: "Invalid Gov Pay return data",
                    startNewApplicationUrl: startNewApplicationUrl,
                });
            }

            // update database (add payment reference)
            await ApplicationPaymentDetails.update({
                payment_reference: returnData.payment_id
            }, {
                where: { application_id: appid }
            });

            // redirect to next form page with parameters
            res.redirect(returnData._links.next_url.href);

        } catch (error) {
            console.error(`${appid} - ${error.message}`);
            res.render('payment-error', {
                errorMessage: 'Payment system error',
                startNewApplicationUrl: startNewApplicationUrl
            });
        }
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

        .get('/payment-confirmation', async function(req, res) {
        const appIdFromGovPay = req.query.id;
        const startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl;
        const appId = req.session.appId;

        if (!appId || appId === 0) {
            console.log(`${appIdFromGovPay} - Application has missing session. Rendering error page.`);
            await res.clearCookie('LoggedIn');
            req.session.appId = false;
            return res.render('payment-error', {
                errorMessage: 'Missing user session',
                startNewApplicationUrl: startNewApplicationUrl
            });
        }

        try {
            const results = await ApplicationPaymentDetails.findOne({ where: { application_id: appId } });
            const payment_id = results.payment_reference;

            const response = await axios.get(configGovPay.configs.ukPayUrl + payment_id, {
                headers: {
                    'Authorization': `Bearer ${configGovPay.configs.ukPayApiKey}`
                }
            });

            const returnData = response.data;

            if (!isReturnDataValidForPaymentConfirmation(returnData)) {
                return res.render("payment-error", {
                    errorMessage: "Invalid Gov Pay return data",
                    startNewApplicationUrl: startNewApplicationUrl,
                });
            }

            const { status, finished } = returnData.state;
            const appReference = returnData.reference;

            if (status === 'success' && finished === true) {
                await ApplicationPaymentDetails.update({
                    payment_complete: true,
                    payment_status: 'AUTHORISED'
                }, {
                    where: {
                        application_id: appId
                    }
                });

                console.log(`${appId} - payment is successful`);
                res.redirect(`${configGovPay.configs.applicationServiceReturnUrl}?id=${appId}&appReference=${appReference}`);

            } else {
                console.log(`${appId} - payment is NOT successful`);
                const loggedIn = GovPay.loggedInStatus(req);
                const usersEmail = loggedIn ? GovPay.loggedInUserEmail(req) : GovPay.loggedOutUserEmail(req);
                const isSessionValid = GovPay.isSessionValid(req);

                try {
                    const application = await Application.findOne({ where: { application_id: appId } });
                    const applicationDetail = await ApplicationPaymentDetails.findOne({ where: { application_id: appId } });
                    const userDetails = await UserDetails.findOne({ where: { application_id: appId } });
                    const userDocumentCount = await UserDocumentCount.findOne({ where: { application_id: appId } });

                    let formFields = GovPay.buildUkPayData({}, applicationDetail, application, usersEmail);

                    const retryResponse = await axios.post(configGovPay.configs.ukPayUrl, formFields, {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Authorization': `Bearer ${configGovPay.configs.ukPayApiKey}`
                        }
                    });

                    const retryData = retryResponse.data;

                    if (!isReturnDataValidForUnsuccessfulPaymentConfirmation(retryData)) {
                        return res.render("payment-error", {
                            errorMessage: "Invalid Gov Pay return data",
                            startNewApplicationUrl: startNewApplicationUrl,
                        });
                    }

                    await ApplicationPaymentDetails.update({
                        payment_reference: retryData.payment_id
                    }, {
                        where: {
                            application_id: appId
                        }
                    });

                    console.log(`${appId} - rendering failed payment page`);
                    res.render('payment-confirmation.ejs', {
                        applicationId: appId,
                        applicationType: application.serviceType,
                        next_url: retryData._links.next_url.href,
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

                } catch (error) {
                    console.error(`${appId} - ${error.message}`);
                }
            }
        } catch (error) {
            console.error(`${appId} - ${error.message}`);
            res.render('payment-error', {
                errorMessage: 'Payment system error',
                startNewApplicationUrl: startNewApplicationUrl
            });
        }
    });

};
