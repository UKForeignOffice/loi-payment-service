const common = require('./common.js'),
    moment = require('moment'),
    configGovPay = common.config(),
    request = require('request-promise');

const jobs ={
    //====================================
    //THIS JOB ATTEMPTS TO CALL
    //GOV PAY AND OBTAIN A PAYMENT STATUS
    //THEN UPDATE THE DATABASE
    //ALSO WORKS FOR ADDITIONAL PAYMENTS
    //====================================

    paymentCleanup: async function() {

        const formattedDate = moment().toISOString(),
            { Op } = require("sequelize"),
            sequelize = require('../models/index').sequelize,
            PaymentsCleanupJob = require('../models/index').PaymentsCleanupJob,
            ApplicationPaymentDetails = require('../models/index').ApplicationPaymentDetails,
            Application = require('../models/index').Application,
            AdditionalPaymentDetails = require('../models/index').AdditionalPaymentDetails

        try {

            await start()

            let dbIsUnlocked = await checkIfDbIsUnLocked()
            if (!dbIsUnlocked) {

                await abort('DUE TO DB LOCK')
                throw new Error('EXITING');

            } else {

                await lockDb()

                let problemPayments = await searchEligiblePayments()
                let problemAdditionalPayments = await searchEligibleAdditionalPayments()

                if (problemPayments.length === 0) {

                    await abort('AS NO ELIGIBLE PAYMENTS EXIST')

                } else {

                    await processPayments(problemPayments)

                }

                if (problemAdditionalPayments.length === 0) {

                    await abort('AS NO ELIGIBLE ADDITIONAL PAYMENTS EXIST')

                } else {

                    await processAdditionalPayments(problemAdditionalPayments)

                }

            }

            await unLockDb()
            await stop()

        } catch (error) {
            console.log(error)
        }


        async function start() {
            console.log('[%s][PAYMENT CLEANUP JOB] STARTED', formattedDate);
        }

        async function stop() {
            console.log('[%s][PAYMENT CLEANUP JOB] FINISHED', formattedDate);
        }

        async function abort(reason) {
            console.log('[%s][PAYMENT CLEANUP JOB] ABORTED %s', formattedDate, reason);
        }

        async function checkIfDbIsUnLocked() {
            try {
                return await PaymentsCleanupJob.findOne({
                    where:{
                        id:1,
                        lock:false
                    }
                })
            } catch (error) {
                console.log(error)
            }
        }

        async function lockDb() {
            try {
                console.log('[%s][PAYMENT CLEANUP JOB] LOCKING DB', formattedDate);
                return await PaymentsCleanupJob.update({
                    lock:true
                }, {
                    where:{
                        id:1
                    }
                })
            } catch (error) {
                console.log(error)
            }
        }

        async function unLockDb() {
            try {
                console.log('[%s][PAYMENT CLEANUP JOB] UNLOCKING DB', formattedDate);
                return await PaymentsCleanupJob.update({
                    lock:false
                }, {
                    where:{
                        id:1
                    }
                })
            } catch (error) {
                console.log(error)
            }
        }

        async function searchEligiblePayments() {
            try {
                // Only search the past 3 days of transactions
                // No point searching the entire DB each time
                return await ApplicationPaymentDetails.findAll({
                    where:{
                        payment_status: null,
                        payment_complete: false,
                        payment_reference:{
                            [Op.ne]: null
                        },
                        createdAt: {
                            [Op.gte]: moment().subtract(3, 'days').toDate()
                        }
                    }
                })
            } catch (error) {
                console.log(error)
            }
        }

        async function searchEligibleAdditionalPayments() {
            try {
                // Only search the past 3 days of transactions
                // No point searching the entire DB each time
                return await AdditionalPaymentDetails.findAll({
                    where:{
                        payment_status: 'created',
                        payment_complete: false,
                        payment_reference:{
                            [Op.ne]: null
                        },
                        created_at: {
                            [Op.gte]: moment().subtract(3, 'days').toDate()
                        },
                        submitted: 'draft'
                    }
                })
            } catch (error) {
                console.log(error)
            }
        }

        async function updatePaymentStatus(problemCase, status) {
            console.log('[%s][PAYMENT CLEANUP JOB] UPDATING STATUS FOR %s - %s', formattedDate, problemCase.application_id, problemCase.payment_reference);
            try {
                return await ApplicationPaymentDetails.update({
                    payment_complete: true,
                    payment_status: (status === 'success') ? 'AUTHORISED' : status
                }, {
                    where:{
                        payment_reference: problemCase.payment_reference
                    }
                })
            } catch (error) {
                console.log(error)
            }
        }

        async function updateAdditionalPaymentStatus(problemCase, status) {
            console.log('[%s][PAYMENT CLEANUP JOB] UPDATING STATUS FOR ADDITIONAL PAYMENT %s - %s', formattedDate, problemCase.application_id, problemCase.payment_reference);
            try {
                return await AdditionalPaymentDetails.update({
                    payment_complete: true,
                    payment_status: (status === 'success') ? 'AUTHORISED' : status
                }, {
                    where:{
                        payment_reference: problemCase.payment_reference
                    }
                })
            } catch (error) {
                console.log(error)
            }
        }

        async function exportAppData(problemCase) {
            try {
                console.log('[%s][PAYMENT CLEANUP JOB] EXPORT APP DATA FOR %s - %s', formattedDate, problemCase.application_id, problemCase.payment_reference);
                return await sequelize.query('SELECT * FROM populate_exportedapplicationdata(' + problemCase.application_id + ')');
            } catch (error) {
                console.log(error)
            }
        }

        async function exportEAppData(problemCase) {
            try {
                console.log('[%s][PAYMENT CLEANUP JOB] EXPORT E-APP DATA FOR %s - %s', formattedDate, problemCase.application_id, problemCase.payment_reference);
                return await sequelize.query('SELECT * FROM populate_exportedeApostilleAppdata(' + problemCase.application_id + ')');
            } catch (error) {
                console.log(error)
            }
        }

        async function checkAppStatus(appId) {
            try {
                return await Application.findOne({
                    where:{
                        application_id:appId
                    }
                })
            } catch (error) {
                console.log(error)
            }
        }

        async function checkAdditionalPaymentAppStatus(appId) {
            try {
                return await AdditionalPaymentDetails.findOne({
                    where:{
                        application_id:appId
                    }
                })
            } catch (error) {
                console.log(error)
            }
        }

        async function queueApplication(problemCase) {
            try {
                console.log('[%s][PAYMENT CLEANUP JOB] QUEUING APPLICATION %s - %s', formattedDate, problemCase.application_id, problemCase.payment_reference);
                return await Application.update({
                    submitted: 'queued'
                }, {
                    where:{
                        application_id: problemCase.application_id
                    }
                })
            } catch (error) {
                console.log(error)
            }
        }

        async function queueAdditionalPayment(problemCase) {
            try {
                console.log('[%s][PAYMENT CLEANUP JOB] QUEUING ADDITIONAL PAYMENT %s - %s', formattedDate, problemCase.application_id, problemCase.payment_reference);
                return await AdditionalPaymentDetails.update({
                    submitted: 'queued',
                    updated_at: moment().format('DD MMMM YYYY, h:mm:ss A')
                }, {
                    where:{
                        application_id: problemCase.application_id
                    }
                })
            } catch (error) {
                console.log(error)
            }
        }

        async function callGovPaymentsApi(problemCase) {
            try {
                let options = {
                    method: 'GET',
                    uri: configGovPay.configs.ukPayUrl + problemCase.payment_reference,
                    headers: {
                        "Authorization": "Bearer " + configGovPay.configs.ukPayApiKey
                    }
                }
                return await request(options)
            } catch (error) {
                console.log(error)
            }
        }

        async function processPayments(problemPayments) {
            try {
                for (let problemCase of problemPayments) {
                    let returnData = JSON.parse(await callGovPaymentsApi(problemCase))
                    let status = returnData.state.status
                    let paymentIsFinished = returnData.state.finished
                    let createdDate = returnData.created_date
                    let paymentIsOldEnough = moment(createdDate).isBefore(moment().subtract(3, 'hours').toDate());

                    // Give the payment time to complete. We check if
                    // it was created more than 3 hours ago
                    // If so, do stuff
                    if (paymentIsOldEnough) {
                        if (paymentIsFinished && paymentIsFinished === true) {
                            console.log('[%s][PAYMENT CLEANUP JOB] PROCESSING %s - %s', formattedDate, problemCase.application_id, problemCase.payment_reference);
                            await updatePaymentStatus(problemCase, status)

                            if (status === 'success') {
                                let appStatus = await checkAppStatus(problemCase.application_id)

                                // If the payment is still draft in the Application table
                                // Export the app data and update the status to queued
                                if (appStatus && appStatus.submitted === 'draft') {
                                    const isEApp = problemCase.serviceType === 4;
                                    let exportedAppData = isEApp ? await exportEAppData(problemCase) : await exportAppData(problemCase)
                                    let exportedAppDataResult = isEApp ? exportedAppData[0][0].populate_exportedeApostilleAppdata : exportedAppData[0][0].populate_exportedapplicationdata

                                    //If the return value is 1 indicating success
                                    //then queue the application.
                                    if (exportedAppDataResult && exportedAppDataResult === 1) {
                                        await queueApplication(problemCase)
                                    }
                                }
                            }
                        }
                    } else {
                        await abort('AS APPLICATION ' + problemCase.application_id + ' - ' + problemCase.payment_reference + ' ISN\'T OLD ENOUGH TO PROCESS')
                    }
                }
            } catch (error) {
                console.log(error)
            }
        }

        async function processAdditionalPayments(problemAdditionalPayments) {
            try {
                for (let problemCase of problemAdditionalPayments) {
                    let returnData = JSON.parse(await callGovPaymentsApi(problemCase))
                    let status = returnData.state.status
                    let paymentIsFinished = returnData.state.finished
                    let createdDate = returnData.created_date
                    let paymentIsOldEnough = moment(createdDate).isBefore(moment().subtract(3, 'hours').toDate());

                    // Give the payment time to complete. We check if
                    // it was created more than 3 hours ago
                    // If so, do stuff
                    if (paymentIsOldEnough) {
                        if (paymentIsFinished && paymentIsFinished === true) {
                            console.log('[%s][PAYMENT CLEANUP JOB] PROCESSING ADDITIONAL PAYMENT %s - %s', formattedDate, problemCase.application_id, problemCase.payment_reference);
                            await updateAdditionalPaymentStatus(problemCase, status)

                            if (status === 'success') {
                                let appStatus = await checkAdditionalPaymentAppStatus(problemCase.application_id)

                                // If the payment is still draft in the AdditionalPaymentDetails table
                                // Update the status to queued
                                if (appStatus && appStatus.submitted === 'draft') {
                                    await queueAdditionalPayment(problemCase)
                                }
                            }
                        }
                    } else {
                        await abort('AS ADDITIONAL PAYMENT ' + problemCase.application_id + ' - ' + problemCase.payment_reference + ' ISN\'T OLD ENOUGH TO PROCESS')
                    }
                }
            } catch (error) {
                console.log(error)
            }
        }
    }
};
module.exports = jobs;
