var Model = require('../models/index'),
    sequelize = require('../models/index').sequelize,
    common = require('./common.js'),
    moment = require('moment'),
    configGovPay = common.config(),
    request = require('request-promise');

var jobs ={
    //====================================
    //THIS JOB ATTEMPTS TO CALL
    //GOV PAY AND OBTAIN A PAYMENT STATUS
    //THEN UPDATE THE DATABASE
    //====================================
    paymentCleanup: async function() {

        let formattedDate = moment().toISOString();

        try {

            await start()

            let dbIsUnlocked = await checkIfDbIsUnLocked()
            if (!dbIsUnlocked) {

                await abort('DUE TO DB LOCK')
                throw new Error('EXITING');

            } else {

                await lockDb()

                let problemPayments = await searchEligiblePayments()

                if (problemPayments.length === 0) {

                    await abort('AS NO ELIGIBLE PAYMENTS EXIST')

                } else {

                    await processPayments(problemPayments)

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
                return await Model.PaymentsCleanupJob.find({
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
                return await Model.PaymentsCleanupJob.update({
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
                return await Model.PaymentsCleanupJob.update({
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
                return await Model.ApplicationPaymentDetails.findAll({
                    where:{
                        payment_status:null,
                        payment_complete:false,
                        payment_reference:{
                            $ne: null
                        },
                        createdAt: {
                            $gte: moment().subtract(3, 'days').toDate()
                        }
                    }
                })
            } catch (error) {
                console.log(error)
            }
        }

        async function updatePaymentStatus(problemCase, status) {
            console.log('[%s][PAYMENT CLEANUP JOB] UPDATING STATUS FOR %s - %s', formattedDate, problemCase.application_id, problemCase.payment_reference);
            try {
                return await Model.ApplicationPaymentDetails.update({
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

        async function checkAppStatus(appId) {
            try {
                return await Model.Application.find({
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
                return await Model.Application.update({
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
                                    let exportedAppData = await exportAppData(problemCase)
                                    let exportedAppDataResult = exportedAppData[0][0].populate_exportedapplicationdata

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
    }
};
module.exports = jobs;
