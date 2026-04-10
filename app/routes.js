const GovPay = require('../lib/helper');
const EmailService =require('./../lib/EmailService')
const axios = require('axios');
const moment = require("moment");
const { Application, ApplicationPaymentDetails, UserDetails, UserDocumentCount, AdditionalPaymentDetails } = require('../models/index');

module.exports = function(router, configGovPay, app) {

    const DEFAULT_SESSION_TTL = configGovPay.sessionSettings.cookieMaxAge

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
        let startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl + "/additional-payments";

        try {
            let sess = req.session;
            let applicationRef = sess.additionalPayments.applicationRef;
            let applicationAmount = sess.additionalPayments.applicationAmount;
            let applicationEmail = sess.additionalPayments.applicationEmail;

            // Build required data
            let formFields = GovPay.additionalPaymentsAddBaseData({}, applicationRef, applicationAmount, applicationEmail);

            const response = await axios.post(configGovPay.configs.ukPayUrl, JSON.stringify(formFields), {
                headers: {
                    "content-type": "application/json; charset=utf-8",
                    "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey,
                }
            });

            let returnData = response.data;

            if (!isReturnDataValidForSubmitAdditionalPayment(returnData)) {
                return res.render("additional-payment-error", {
                    errorMessage: "Invalid Gov Pay return data",
                    startNewApplicationUrl: startNewApplicationUrl,
                });
            }

            let next_url = returnData._links.next_url.href;
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
                        created_at: moment(returnData.created_date).format("DD MMMM YYYY, h:mm:ss A"),
                        submitted: "draft",
                    });
                }
            }

            return res.render("additionalPayments/submit-additional-payment", {
                cost: applicationAmount,
                next_url: next_url,
                startNewApplicationUrl: startNewApplicationUrl,
            });

        } catch (error) {
            console.error(error);
            return res.render("additional-payment-error", {
                errorMessage: error.message || "Error processing payment",
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
        let startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl + '/additional-payments';
        try {
            let sess = req.session;
            let payment_id = sess.additionalPayments.paymentReference;
            let isSessionValid = (typeof sess.additionalPayments.applicationAmount !== 'undefined');

            const response = await axios.get(`${configGovPay.configs.ukPayUrl}${payment_id}`, {
                headers: {
                    "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey
                }
            });

            const returnData = response.data;

            if (!isReturnDataValidForProcessAdditionalPayment(returnData)) {
                return res.render("additional-payment-error", {
                    errorMessage: "Invalid Gov Pay return data",
                    startNewApplicationUrl: startNewApplicationUrl,
                });
            }

            let status = returnData.state.status;
            let finished = returnData.state.finished;
            let appReference = returnData.reference;
            let paymentMethod = returnData.card_details?.card_brand;
            let createdDate = moment(returnData.created_date).format('DD MMMM YYYY, h:mm:ss A');
            let cost = returnData.amount / 100;

            if (status === 'success' && finished) {
                console.log(`${payment_id} - payment is successful`);
                if (sess.additionalPayments.applicationRef) {
                    await AdditionalPaymentDetails.update({
                        payment_status: 'AUTHORISED',
                        payment_reference: payment_id,
                        payment_amount: cost,
                        payment_complete: true,
                        updated_at: moment().format('DD MMMM YYYY, h:mm:ss A'),
                        submitted: 'queued',
                        submission_request: null,
                        submission_response_code: null
                    }, {
                        where: {
                            application_id: returnData.reference
                        }
                    });
                }

                if (typeof sess.additionalPayments.applicationAmount !== 'undefined') {
                    EmailService.additionalPaymentReceipt(
                        sess.additionalPayments.applicationEmail,
                        createdDate,
                        appReference,
                        'Get Document Legalised – Additional Payments',
                        sess.additionalPayments.applicationAmount,
                        paymentMethod
                    );
                }

                // Reset session to default TTL after successful payment.
                return updateSessionMaxAge(req, DEFAULT_SESSION_TTL, () => {
                    res.render('additionalPayments/additional-payment-confirmation', {
                        req:req,
                        isSessionValid: isSessionValid,
                        paymentSuccessful: true,
                        appReference: appReference,
                        createdDate: createdDate,
                        paymentMethod: paymentMethod,
                        cost: sess.additionalPayments.applicationAmount,
                        email: sess.additionalPayments.applicationEmail,
                        startNewApplicationUrl: startNewApplicationUrl
                    });
                });

            } else {
                console.log(`${payment_id} - payment is NOT successful`);
                await retryAdditionalPayment(req, sess, res, startNewApplicationUrl);
            }

        } catch (error) {
            console.error(error);
            res.render('additional-payment-error', {
                errorMessage: error.message || 'Payment system error',
                startNewApplicationUrl: startNewApplicationUrl
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
        const appid = req.session.appId;
        const startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl;

        if (!req.session.appId || req.session.appId === 0) {
            res.clearCookie('LoggedIn');
            req.session.appId = false;
            return res.render('payment-error', {
                errorMessage: 'Missing user session',
                startNewApplicationUrl: startNewApplicationUrl
            });
        }

        const loggedIn = GovPay.loggedInStatus(req);
        const usersEmail = loggedIn ? GovPay.loggedInUserEmail(req) : GovPay.loggedOutUserEmail(req);

        try {
            const application = await Application.findOne({ where: { application_id: appid } });
            const applicationDetail = await ApplicationPaymentDetails.findOne({ where: { application_id: appid } });

            if (applicationDetail && applicationDetail.payment_url) {
                return res.redirect(applicationDetail.payment_url);
            }

            var formFields = {};
            formFields = GovPay.buildUkPayData(formFields, applicationDetail, application, usersEmail);

            const response = await axios.post(configGovPay.configs.ukPayUrl, JSON.stringify(formFields), {
                headers: {
                    "content-type": "application/json; charset=utf-8",
                    "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey
                }
            });

            const returnData = response.data;

            if (!isReturnDataValidForSubmitPayment(returnData)) {
                return res.render("payment-error", {
                    errorMessage: "Invalid Gov Pay return data",
                    startNewApplicationUrl: startNewApplicationUrl,
                });
            }

            await ApplicationPaymentDetails.update({
                payment_reference: returnData.payment_id,
                payment_url: returnData._links.next_url.href
            }, {
                where: { application_id: appid }
            });

            const updatedApplicationDetail = await ApplicationPaymentDetails.findOne({ where: { application_id: appid } });
            const paymentUrl = updatedApplicationDetail.payment_url

            return res.redirect(paymentUrl);

        } catch (error) {
            console.error(appid + ' - ' + error);
            return res.render("payment-error", {
                errorMessage: "Problem processing payment",
                startNewApplicationUrl: startNewApplicationUrl,
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

    function showErrorPage(req, res, errorMessage, startNewApplicationUrl) {
        res.clearCookie('LoggedIn');
        req.session.appId = false;
        return res.render('payment-error', {
            errorMessage: errorMessage,
            startNewApplicationUrl
        });
    }

    function isValidInteger(value) {
        const number = parseInt(value, 10); // Always specify radix 10 for decimal
        return !isNaN(number); // Check if the result is a valid number
    }

    function updateSessionMaxAge(req, maxAgeMs, done) {
        if (!req.session) {
            return done();
        }

        const ttl = parseInt(maxAgeMs, 10);
        if (isNaN(ttl) || ttl <= 0) {
            console.error(`Invalid maxAge value: ${maxAgeMs}`);
            return done();
        }

        req.session.cookie.maxAge = ttl;
        req.session.cookie.originalMaxAge = ttl;
        req.session.cookie.expires = new Date(Date.now() + ttl);

        req.session.save((err) => {
            if (err) {
                console.error(`Failed to update session maxAge: ${err}`);
            }
            return done();
        });
    }

    router.get('/payment-confirmation', async function(req, res) {
        const appIdFromGovPay = req.query.id;
        const startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl;
        const appId = req.session.appId;

        if (!isValidInteger(appIdFromGovPay)) {
            console.log(`${appIdFromGovPay} - Invalid application reference. Rendering error page.`);
            return showErrorPage(req, res, 'Invalid application reference', startNewApplicationUrl);
        }

        try {
            const results = await ApplicationPaymentDetails.findOne({where: { application_id: appIdFromGovPay }});
            if (!results) {
                console.log(`${appIdFromGovPay} - Application not found in database. Rendering error page.`);
                return showErrorPage(req, res, 'Application not found in database', startNewApplicationUrl);
            }
            const payment_id = results.payment_reference;

            const response = await axios.get(`${configGovPay.configs.ukPayUrl}${payment_id}`, {
                headers: { "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey }
            });

            const returnData = response.data;

            if (!isReturnDataValidForPaymentConfirmation(returnData)) {
                console.log(`${appIdFromGovPay} - Invalid Gov Pay return data. Rendering error page.`);
                return showErrorPage(req, res, 'Invalid Gov Pay return data', startNewApplicationUrl);
            }

            if (returnData.state.status === 'success' && returnData.state.finished === true) {
                await ApplicationPaymentDetails.update({
                    payment_complete: true,
                    payment_status: 'AUTHORISED',
                    payment_url: null
                }, {
                    where: { application_id: appIdFromGovPay }
                });

                console.log(`${appIdFromGovPay} - payment is successful`);

                // Reset session to default TTL after successful payment
                return updateSessionMaxAge(req, DEFAULT_SESSION_TTL, () => {
                    if (!appId || appId === 0) {
                        console.log(`${appIdFromGovPay} - Application has missing session. Rendering error page.`);
                        return showErrorPage(req, res, 'Missing user session', startNewApplicationUrl);
                    }

                    return res.redirect(`${configGovPay.configs.applicationServiceReturnUrl}?id=${appIdFromGovPay}&appReference=${returnData.reference}`);
                });
            } else {
                console.log(`${appIdFromGovPay} - payment is NOT successful`);

                // Keep current session TTL; only reset on successful payment.
                // If the user's session is missing, show them an error
                if (!appId || appId === 0) {
                    console.log(`${appIdFromGovPay} - Application has missing session. Rendering error page.`);
                    return showErrorPage(req, res, 'Missing user session', startNewApplicationUrl);
                }

                return retryPayment(appIdFromGovPay, req, res);
            }
        } catch (error) {
            console.error(`${appIdFromGovPay} - ${error}`);
            showErrorPage(req, res, 'Payment system error', startNewApplicationUrl);
        }
    });

    async function retryPayment(appId, req, res) {
        const [application, applicationDetail, userDetails, userDocumentCount] = await Promise.all([
            Application.findOne({ where: { application_id: appId } }),
            ApplicationPaymentDetails.findOne({ where: { application_id: appId } }),
            UserDetails.findOne({ where: { application_id: appId } }),
            UserDocumentCount.findOne({ where: { application_id: appId } })
        ]);
        const startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl;
        const loggedIn = GovPay.loggedInStatus(req);
        const usersEmail = loggedIn ? GovPay.loggedInUserEmail(req) : GovPay.loggedOutUserEmail(req);
        const formFields = GovPay.buildUkPayData({}, applicationDetail, application, usersEmail);
        const isSessionValid = GovPay.isSessionValid(req);

        try {
            const response = await axios.post(configGovPay.configs.ukPayUrl, JSON.stringify(formFields), {
                headers: {
                    "content-type": "application/json; charset=utf-8",
                    "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey
                }
            });

            const returnData = response.data;
            const next_url = returnData._links.next_url.href

            if (!isReturnDataValidForUnsuccessfulPaymentConfirmation(returnData)) {
                return res.render("payment-error", {
                    errorMessage: "Invalid Gov Pay return data",
                    startNewApplicationUrl: startNewApplicationUrl,
                });
            }

            await ApplicationPaymentDetails.update({
                payment_reference: returnData.payment_id,
                payment_url: next_url
            }, {
                where: { application_id: appId }
            });

            console.log(`${appId} - rendering failed payment page`);

            return res.render('payment-confirmation.ejs',
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
        } catch (error) {
            console.error(`${appId} - ${error}`);
            return res.render("payment-error", {
                errorMessage: "Error processing payment retry",
                startNewApplicationUrl: configGovPay.configs.startNewApplicationUrl,
            });
        }
    }

    async function retryAdditionalPayment(req, sess, res, startNewApplicationUrl) {
        try {
            let formFields = GovPay.additionalPaymentsAddBaseData({}, sess.additionalPayments.applicationRef, sess.additionalPayments.applicationAmount, sess.additionalPayments.applicationEmail);
            const response = await axios.post(configGovPay.configs.ukPayUrl, JSON.stringify(formFields), {
                headers: {
                    "content-type": "application/json; charset=utf-8",
                    "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey
                }
            });

            const returnData = response.data;

            if (!isReturnDataValidForUnsuccessfulAdditionalPayment(returnData)) {
                return res.render("additional-payment-error", {
                    errorMessage: "Invalid Gov Pay return data",
                    startNewApplicationUrl: startNewApplicationUrl,
                });
            }

            let next_url = returnData._links.next_url?.href;
            sess.additionalPayments.paymentReference = returnData.payment_id;

            return res.render('additionalPayments/additional-payment-confirmation', {
                 isSessionValid: true,
                 paymentSuccessful: false,
                 cost: sess.additionalPayments.applicationAmount,
                 next_url: next_url,
                 startNewApplicationUrl: startNewApplicationUrl
             });

        } catch (error) {
            console.error(error);
            res.render("additional-payment-error", {
                errorMessage: error.message || "Error processing payment retry",
                startNewApplicationUrl: startNewApplicationUrl,
            });
        }
    }
};
