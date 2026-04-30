const common = require('./common.js'),
  moment = require('moment'),
  configGovPay = common.config(),
  axios = require('axios'),
  { S3, ListObjectsV2Command } = require('@aws-sdk/client-s3'),
  s3 = new S3()

const jobs = {
  //====================================
  //THIS JOB ATTEMPTS TO CALL
  //GOV PAY AND OBTAIN A PAYMENT STATUS
  //THEN UPDATE THE DATABASE
  //ALSO WORKS FOR ADDITIONAL PAYMENTS
  //====================================

  paymentCleanup: async () => {
    const { Op } = require('sequelize'),
      sequelize = require('../models/index').sequelize,
      PaymentsCleanupJob = require('../models/index').PaymentsCleanupJob,
      ApplicationPaymentDetails = require('../models/index').ApplicationPaymentDetails,
      Application = require('../models/index').Application,
      AdditionalPaymentDetails = require('../models/index').AdditionalPaymentDetails,
      UploadedDocumentUrls = require('../models/index').UploadedDocumentUrls,
      ExportedApplicationData = require('../models/index').ExportedApplicationData

    try {
      await start()

      const dbIsUnlocked = await checkIfDbIsUnLocked()
      if (!dbIsUnlocked) {
        await abort('DUE TO DB LOCK')
        throw new Error('EXITING')
      } else {
        await lockDb()

        const problemPayments = await searchEligiblePayments()
        const problemAdditionalPayments = await searchEligibleAdditionalPayments()
        const paidInDraftApps = await searchPaidInDraftApps()

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

        if (paidInDraftApps.length === 0) {
          await abort('AS NO ELIGIBLE PAID IN DRAFT APPS EXIST')
        } else {
          await processPaidInDraftApps(paidInDraftApps)
        }
      }
    } catch (error) {
      console.log(error)
    } finally {
      await unLockDb()
      await stop()
    }

    function start() {
      console.log(`[PAYMENT CLEANUP JOB] STARTED`)
    }

    function stop() {
      console.log(`[PAYMENT CLEANUP JOB] FINISHED`)
    }

    function abort(reason) {
      console.log(`[PAYMENT CLEANUP JOB] ABORTED ${reason}`)
    }

    async function checkIfDbIsUnLocked() {
      try {
        return await PaymentsCleanupJob.findOne({
          where: {
            id: 1,
            lock: false,
          },
        })
      } catch (error) {
        console.log(error)
      }
    }

    async function lockDb() {
      try {
        console.log(`[PAYMENT CLEANUP JOB] LOCKING DB`)
        return await PaymentsCleanupJob.update(
          {
            lock: true,
          },
          {
            where: {
              id: 1,
            },
          },
        )
      } catch (error) {
        console.log(error)
      }
    }

    async function unLockDb() {
      try {
        console.log(`[PAYMENT CLEANUP JOB] UNLOCKING DB`)
        return await PaymentsCleanupJob.update(
          {
            lock: false,
          },
          {
            where: {
              id: 1,
            },
          },
        )
      } catch (error) {
        console.log(error)
      }
    }

    async function searchEligiblePayments() {
      try {
        // Only search the past 3 days of transactions
        // No point searching the entire DB each time
        return await ApplicationPaymentDetails.findAll({
          where: {
            payment_status: null,
            payment_complete: false,
            payment_reference: {
              [Op.ne]: null,
            },
            createdAt: {
              [Op.gte]: moment().subtract(3, 'days').toDate(),
            },
          },
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
          where: {
            payment_status: 'created',
            payment_complete: false,
            payment_reference: {
              [Op.ne]: null,
            },
            created_at: {
              [Op.gte]: moment().subtract(3, 'days').toDate(),
            },
            submitted: 'draft',
          },
        })
      } catch (error) {
        console.log(error)
      }
    }

    async function searchPaidInDraftApps() {
      try {
        return await sequelize.query(
          `SELECT "a"."application_id", "a"."unique_app_id", "a"."submitted", "a"."serviceType", "epd"."payment_status" FROM "Application" a INNER JOIN "ApplicationPaymentDetails" AS epd ON a.application_id = epd.application_id WHERE "a"."submitted" = 'draft' AND "epd"."payment_status" = 'AUTHORISED' ORDER BY "a"."unique_app_id";`,
          {
            type: sequelize.QueryTypes.SELECT,
          },
        )
      } catch (error) {
        console.log(error)
      }
    }

    async function updatePaymentStatus(problemCase, status) {
      console.log(
        `[PAYMENT CLEANUP JOB] UPDATING STATUS FOR ${problemCase.application_id} - ${problemCase.payment_reference}`,
      )
      try {
        return await ApplicationPaymentDetails.update(
          {
            payment_complete: true,
            payment_status: status === 'success' ? 'AUTHORISED' : status,
          },
          {
            where: {
              payment_reference: problemCase.payment_reference,
            },
          },
        )
      } catch (error) {
        console.log(error)
      }
    }

    async function updateAdditionalPaymentStatus(problemCase, status) {
      console.log(
        `[PAYMENT CLEANUP JOB] UPDATING STATUS FOR ADDITIONAL PAYMENT ${problemCase.application_id} - ${problemCase.payment_reference}`,
      )
      try {
        return await AdditionalPaymentDetails.update(
          {
            payment_complete: true,
            payment_status: status === 'success' ? 'AUTHORISED' : status,
          },
          {
            where: {
              payment_reference: problemCase.payment_reference,
            },
          },
        )
      } catch (error) {
        console.log(error)
      }
    }

    async function exportAppData(problemCase) {
      try {
        console.log(`[PAYMENT CLEANUP JOB] EXPORT APP DATA FOR ${problemCase.application_id}`)
        return await sequelize.query(`SELECT * FROM populate_exportedapplicationdata(${problemCase.application_id})`)
      } catch (error) {
        console.log(error)
      }
    }

    async function exportEAppData(problemCase) {
      try {
        console.log(`[PAYMENT CLEANUP JOB] EXPORT E-APP DATA FOR ${problemCase.application_id}`)
        return await sequelize.query(`SELECT * FROM populate_exportedeApostilleAppdata(${problemCase.application_id})`)
      } catch (error) {
        console.log(error)
      }
    }

    async function checkForExportedAppData(app) {
      try {
        console.log(`[PAYMENT CLEANUP JOB] CHECK IF EXPORTED APP DATA EXISTS FOR ${app.application_id}`)
        return await ExportedApplicationData.findOne({
          where: {
            application_id: app.application_id,
          },
        })
      } catch (error) {
        console.log(error)
      }
    }

    async function checkAdditionalPaymentAppStatus(appId) {
      try {
        return await AdditionalPaymentDetails.findOne({
          where: {
            application_id: appId,
          },
        })
      } catch (error) {
        console.log(error)
      }
    }

    async function queueApplication(problemCase) {
      try {
        console.log(`[PAYMENT CLEANUP JOB] QUEUING APPLICATION ${problemCase.application_id}`)
        return await Application.update(
          {
            submitted: 'queued',
          },
          {
            where: {
              application_id: problemCase.application_id,
            },
          },
        )
      } catch (error) {
        console.log(error)
      }
    }

    async function updateAppAsFailed(app) {
      try {
        console.log(`[PAYMENT CLEANUP JOB] MARKING ${app.application_id} AS FAILED`)
        return await Application.update(
          {
            submitted: 'failed',
          },
          {
            where: {
              application_id: app.application_id,
            },
          },
        )
      } catch (error) {
        console.log(error)
      }
    }

    async function queueAdditionalPayment(problemCase) {
      try {
        console.log(
          `[PAYMENT CLEANUP JOB] QUEUING ADDITIONAL PAYMENT ${problemCase.application_id} - ${problemCase.payment_reference}`,
        )
        return await AdditionalPaymentDetails.update(
          {
            submitted: 'queued',
            updated_at: moment().format('DD MMMM YYYY, h:mm:ss A'),
          },
          {
            where: {
              application_id: problemCase.application_id,
            },
          },
        )
      } catch (error) {
        console.log(error)
      }
    }

    async function callGovPaymentsApi(problemCase) {
      try {
        const options = {
          method: 'GET',
          url: `${configGovPay.configs.ukPayUrl}${problemCase.payment_reference}`,
          headers: {
            Authorization: `Bearer ${configGovPay.configs.ukPayApiKey}`,
          },
        }
        const response = await axios(options)
        return response.data
      } catch (error) {
        console.log(error)
      }
    }

    async function findPDFs(app) {
      try {
        console.log('[PAYMENT CLEANUP JOB] SEARCHING FOR PDFs')
        const S3_BUCKET = configGovPay.configs.s3Bucket
        const prefix = `${app.application_id}_`

        const params = {
          Bucket: S3_BUCKET,
          Prefix: prefix,
        }

        const command = new ListObjectsV2Command(params)
        const data = await s3.send(command)

        if (data.Contents) {
          const pdfFiles = data.Contents.filter((item) => item.Key.endsWith('.pdf')).map((item) => item.Key)
          console.log(`[PAYMENT CLEANUP JOB] FOUND ONE OR MORE PDFs FOR ${app.application_id}`)
          return pdfFiles
        } else {
          console.log(`[PAYMENT CLEANUP JOB] NO PDFs FOUND FOR ${app.application_id}`)
          return []
        }
      } catch (error) {
        console.log(error)
      }
    }

    async function addDocumentUrlToDB(app, pdf) {
      try {
        console.log(`[PAYMENT CLEANUP JOB] ADDING DOCUMENT FOR ${app.application_id}`)
        return await UploadedDocumentUrls.create({
          application_id: app.application_id,
          uploaded_url: pdf,
          createdAt: new Date(),
          updatedAt: new Date(),
          filename: extractFilename(pdf),
          presigned_url: null,
        })
      } catch (error) {
        console.log(error)
      }
    }

    function extractFilename(pdf) {
      const secondUnderscoreIndex = pdf.indexOf('_', pdf.indexOf('_') + 1)
      if (secondUnderscoreIndex !== -1) {
        return pdf.substring(secondUnderscoreIndex + 1)
      }
      return pdf
    }

    async function processPayments(problemPayments) {
      try {
        for (const problemCase of problemPayments) {
          const returnData = await callGovPaymentsApi(problemCase)
          const status = returnData.state.status
          const paymentIsFinished = returnData.state.finished
          const createdDate = returnData.created_date
          const paymentIsOldEnough = moment(createdDate).isBefore(moment().subtract(3, 'hours').toDate())

          // Give the payment time to complete. We check if
          // it was created more than 3 hours ago
          // If so, update the app's payment status
          if (paymentIsOldEnough) {
            if (paymentIsFinished && paymentIsFinished === true) {
              console.log(
                `[PAYMENT CLEANUP JOB] PROCESSING ${problemCase.application_id} - ${problemCase.payment_reference}`,
              )
              await updatePaymentStatus(problemCase, status)
            }
          } else {
            await abort(
              'AS APPLICATION ' +
                problemCase.application_id +
                ' - ' +
                problemCase.payment_reference +
                " ISN'T OLD ENOUGH TO PROCESS",
            )
          }
        }
      } catch (error) {
        console.log(error)
      }
    }

    async function processAdditionalPayments(problemAdditionalPayments) {
      try {
        for (const problemCase of problemAdditionalPayments) {
          const returnData = await callGovPaymentsApi(problemCase)
          const status = returnData.state.status
          const paymentIsFinished = returnData.state.finished
          const createdDate = returnData.created_date
          const paymentIsOldEnough = moment(createdDate).isBefore(moment().subtract(3, 'hours').toDate())

          // Give the payment time to complete. We check if
          // it was created more than 3 hours ago
          // If so, do stuff
          if (paymentIsOldEnough) {
            if (paymentIsFinished && paymentIsFinished === true) {
              console.log(
                `[PAYMENT CLEANUP JOB] PROCESSING ADDITIONAL PAYMENT ${problemCase.application_id} - ${problemCase.payment_reference}`,
              )
              await updateAdditionalPaymentStatus(problemCase, status)

              if (status === 'success') {
                const appStatus = await checkAdditionalPaymentAppStatus(problemCase.application_id)

                // If the payment is still draft in the AdditionalPaymentDetails table
                // Update the status to queued
                if (appStatus && appStatus.submitted === 'draft') {
                  await queueAdditionalPayment(problemCase)
                }
              }
            }
          } else {
            await abort(
              'AS ADDITIONAL PAYMENT ' +
                problemCase.application_id +
                ' - ' +
                problemCase.payment_reference +
                " ISN'T OLD ENOUGH TO PROCESS",
            )
          }
        }
      } catch (error) {
        console.log(error)
      }
    }

    async function processPaidInDraftApps(paidInDraftApps) {
      try {
        for (const app of paidInDraftApps) {
          if (app.serviceType === 4 && configGovPay.configs.nodeEnv.toLowerCase() !== 'development') {
            await handleEAppProcessing(app)
          } else {
            await handleStandardAppProcessing(app)
          }
        }
      } catch (error) {
        console.error(`[PAYMENT CLEANUP JOB] ERROR PROCESSING APPS: ${error.message}`)
      }
    }

    async function handleEAppProcessing(app) {
      try {
        const exportedEAppData = await exportEAppData(app)

        const exportedEAppDataResult = exportedEAppData[0][0].populate_exportedeapostilleappdata

        if (!exportedEAppDataResult || exportedEAppDataResult !== 1) {
          console.error(`[PAYMENT CLEANUP JOB] PROBLEM EXPORTING EAPP DATA FOR ${app.application_id}`)
          return
        }

        const pdfs = await findPDFs(app)

        if (pdfs.length > 0) {
          try {
            await Promise.all(pdfs.map((pdf) => addDocumentUrlToDB(app, pdf)))
            await queueApplication(app)
          } catch (error) {
            console.error(`[PAYMENT CLEANUP JOB] ERROR INSERTING DOCUMENTS FOR ${app.application_id}: ${error.message}`)
            throw new Error(error)
          }
        }
      } catch (error) {
        console.error(`[PAYMENT CLEANUP JOB] ERROR WITH PROCESSING APP ${app.application_id}: ${error.message}`)
      }
    }

    async function handleStandardAppProcessing(app) {
      try {
        const hasExportedAppData = await checkForExportedAppData(app)

        if (!hasExportedAppData) {
          const exportedAppData = await exportAppData(app)

          const [firstEntry] = exportedAppData
          const { populate_exportedapplicationdata } = firstEntry[0]

          if (populate_exportedapplicationdata === 1) {
            await queueApplication(app)
          } else {
            console.error(`[PAYMENT CLEANUP JOB] Failed to export app data for ${app.application_id}`)
            await updateAppAsFailed(app)
          }
        } else {
          await queueApplication(app)
        }
      } catch (error) {
        console.error(`[PAYMENT CLEANUP JOB] Error processing app ${app.application_id}: ${error.message}`)
      }
    }
  },
}
module.exports = jobs
