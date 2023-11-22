const GovPay = require('../lib/helper');
const request = require('request');
const EmailService =require('./../lib/EmailService');
const axios = require('axios');
const moment = require('moment');
const AdditionalPaymentDetails = require("../models/index").AdditionalPaymentDetails; // Adjust the import as needed


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
      let startNewApplicationUrl =
        configGovPay.configs.startNewApplicationUrl + "/additional-payments";

      try {
        const sess = req.session;
        const applicationRef = sess.additionalPayments.applicationRef;
        const applicationAmount = sess.additionalPayments.applicationAmount;
        const applicationEmail = sess.additionalPayments.applicationEmail;

        // Build required data
        let formFields = GovPay.additionalPaymentsAddBaseData(
          {},
          applicationRef,
          applicationAmount,
          applicationEmail
        );

        const axiosConfig = {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: "Bearer " + configGovPay.configs.ukPayApiKey,
          },
        };

        try {
          console.log("attempting response..");
          const response = await axios.post(configGovPay.configs.ukPayUrl, formFields, axiosConfig);

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
              where: {
                application_id: returnData.reference,
              },
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

          res.render("additionalPayments/submit-additional-payment", {
            cost: applicationAmount,
            next_url: next_url,
            startNewApplicationUrl: startNewApplicationUrl,
          });
        } catch (error) {
          console.log(error);
          return res.render("additional-payment-error", {
            errorMessage: "Problem with Gov Pay response",
            startNewApplicationUrl: startNewApplicationUrl,
          });
        }
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

    async function processAdditionalPayment(req, res) {
      try {
        const sess = req.session;
        const isSessionValid = typeof sess.additionalPayments.applicationAmount !== 'undefined';
        const payment_id = sess.additionalPayments.paymentReference;
        const startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl + '/additional-payments';

        try {
          const response = await axios.get(configGovPay.configs.ukPayUrl + payment_id, {
            headers: {
              Authorization: `Bearer ${configGovPay.configs.ukPayApiKey}`,
            },
          });

          const returnData = response.data;

          if (!isReturnDataValidForProcessAdditionalPayment(returnData)) {
            return res.render('additional-payment-error', {
              errorMessage: 'Invalid Gov Pay return data',
              startNewApplicationUrl: startNewApplicationUrl,
            });
          }

          const cost = returnData.amount / 100;
          const status = returnData.state?.status;
          const finished = returnData.state?.finished;
          const appReference = returnData.reference;
          const paymentMethod = returnData.card_details?.card_brand;
          const createdDate = moment(returnData.created_date).format('DD MMMM YYYY, h:mm:ss A');

          if (status && status === 'success' && finished && finished === true) {
            console.log(payment_id + ' - payment is successful');

            if (isSessionValid) {
              // EmailService.additionalPaymentReceipt(...)
              const applicationRef = sess.additionalPayments.applicationRef;

              if (applicationRef) {
                const AdditionalPaymentDetails = require('../models/index').AdditionalPaymentDetails;
                await AdditionalPaymentDetails.update(
                  {
                    payment_status: 'AUTHORISED',
                    payment_reference: payment_id,
                    payment_amount: cost,
                    payment_complete: true,
                    updated_at: moment().format('DD MMMM YYYY, h:mm:ss A'),
                    submitted: 'queued',
                  },
                  {
                    where: {
                      application_id: returnData.reference,
                    },
                  }
                );
              }
            }

            return res.render('additionalPayments/additional-payment-confirmation', {
              req: req,
              isSessionValid: isSessionValid,
              paymentSuccessful: true,
              appReference: appReference,
              createdDate: createdDate,
              paymentMethod: paymentMethod,
              cost: sess.additionalPayments.applicationAmount,
              email: sess.additionalPayments.applicationEmail,
              startNewApplicationUrl: startNewApplicationUrl,
            });
          } else {
            console.log(payment_id + ' - payment is NOT successful');
            let formFields = {};
            formFields = GovPay.additionalPaymentsAddBaseData(formFields, sess.additionalPayments.applicationRef, sess.additionalPayments.applicationAmount, sess.additionalPayments.applicationEmail);

            const response = await axios.post(configGovPay.configs.ukPayUrl, JSON.stringify(formFields), {
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `Bearer ${configGovPay.configs.ukPayApiKey}`,
              },
            });

            const returnData = response.data;

            if (!isReturnDataValidForUnsuccessfulAdditionalPayment(returnData)) {
              return res.render('additional-payment-error', {
                errorMessage: 'Invalid Gov Pay return data',
                startNewApplicationUrl: startNewApplicationUrl,
              });
            }

            const next_url = returnData._links.next_url?.href;
            sess.additionalPayments.paymentReference = returnData.payment_id;

            return res.render('additionalPayments/additional-payment-confirmation', {
              isSessionValid: isSessionValid,
              paymentSuccessful: false,
              cost: sess.additionalPayments.applicationAmount,
              next_url: next_url,
              startNewApplicationUrl: startNewApplicationUrl,
            });
          }
        } catch (error) {
          console.log(error);
          return res.render('additional-payment-error', {
            errorMessage: 'Problem with Gov Pay response',
            startNewApplicationUrl: startNewApplicationUrl,
          });
        }
      } catch (err) {
        const startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl + '/additional-payments';
        console.log(err);
        return res.render('additional-payment-error', {
          errorMessage: err,
          startNewApplicationUrl: startNewApplicationUrl,
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

    const axios = require('axios');

    function submitPayment(req, res) {
      // get the application ID from the request (redirected from application service)
      var appid = req.session.appId;
      var startNewApplicationUrl = configGovPay.configs.startNewApplicationUrl;

      if (req.session.appId && req.session.appId !== 0) {
        // Do nothing
      } else {
        res.clearCookie('LoggedIn');
        req.session.appId = false;
        return res.render('payment-error', {
          errorMessage: 'Missing user session',
          startNewApplicationUrl: startNewApplicationUrl,
        });
      }
      var loggedIn = GovPay.loggedInStatus(req);
      var usersEmail = loggedIn ? GovPay.loggedInUserEmail(req) : GovPay.loggedOutUserEmail(req);

      // get the relevant database models
      var ApplicationPaymentDetails = require('../models/index').ApplicationPaymentDetails;
      var Application = require('../models/index').Application;
      var UserDetails = require('../models/index').UserDetails;
      var UserDocumentCount = require('../models/index').UserDocumentCount;

      // lookup required data from the database
      Application.findOne({ where: { application_id: appid } }).then(function (application) {
        ApplicationPaymentDetails.findOne({ where: { application_id: appid } }).then(function (applicationDetail) {
          UserDetails.findOne({ where: { application_id: appid } }).then(function (userDetails) {
            UserDocumentCount.findOne({ where: { application_id: appid } }).then(function (userDocumentCount) {
              // array to hold data for sending to Payment API
              var formFields = {};
              formFields = GovPay.buildUkPayData(formFields, applicationDetail, application, usersEmail);

              axios
                .post(configGovPay.configs.ukPayUrl, JSON.stringify(formFields), {
                  headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    Authorization: 'Bearer ' + configGovPay.configs.ukPayApiKey,
                  },
                })
                .then((response) => {
                  const returnData = response.data;

                  if (!isReturnDataValidForSubmitPayment(returnData)) {
                    return res.render('payment-error', {
                      errorMessage: 'Invalid Gov Pay return data',
                      startNewApplicationUrl: startNewApplicationUrl,
                    });
                  }

                  const next_url = returnData._links.next_url.href;

                  // update the database (add payment reference)
                  ApplicationPaymentDetails.update(
                    {
                      payment_reference: returnData.payment_id,
                    },
                    {
                      where: {
                        application_id: appid,
                      },
                    }
                  )
                    .then(function () {
                      // redirect to the next form page with parameters
                      return res.redirect(next_url);
                    })
                    .catch(function (error) {
                      console.log(appid + ' - ' + error);
                    });
                })
                .catch((error) => {
                  console.log(JSON.stringify(error));
                  return res.render('payment-error', {
                    errorMessage: 'Problem with Gov Pay response',
                    startNewApplicationUrl: startNewApplicationUrl,
                  });
                });
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
