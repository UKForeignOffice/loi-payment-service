import { config as dotenvConfig } from 'dotenv'

dotenvConfig()

var resultURL = JSON.parse(process.env.RESULTURL)
var notificationServiceURL = JSON.parse(process.env.NOTIFICATIONSERVICEURL)
var applicationServiceReturnUrl = JSON.parse(process.env.APPLICATIONSERVICERETURNURL)
var startNewApplicationUrl = JSON.parse(process.env.STARTNEWAPPLICATIONURL)
var cookieDomain = JSON.parse(process.env.COOKIEDOMAIN)
var db = JSON.parse(process.env.DATABASE)
var live_variables = JSON.parse(process.env.LIVEVARIABLES)
var sessionSettings = JSON.parse(process.env.THESESSION)
var ukPayUrl = JSON.parse(process.env.UKPAYURL)
var ukPayApiKey = JSON.parse(process.env.UKPAYAPIKEY)
var jobScheduleHourlyInterval = JSON.parse(process.env.JOBSCHEDULEHOURLYINTERVAL)
var nodeEnv = process.env.NODE_ENV || 'production'
var s3Bucket = process.env.S3_BUCKET

var configs = {
  resultURL: resultURL.resultURL,
  additionalPaymentsReturnURL: resultURL.additionalPaymentsReturnURL,
  notificationServiceURL: notificationServiceURL.notificationServiceURL,
  applicationServiceReturnUrl: applicationServiceReturnUrl.applicationServiceReturnUrl,
  startNewApplicationUrl: startNewApplicationUrl.startNewApplicationUrl,
  cookieDomain: cookieDomain.cookieDomain,
  ukPayApiKey: ukPayApiKey.ukPayApiKey,
  ukPayUrl: ukPayUrl.ukPayUrl,
  jobScheduleHourlyInterval: jobScheduleHourlyInterval.jobScheduleHourlyInterval,
  nodeEnv,
  s3Bucket,
}

var database = db.database

export const paymentConfig = { configs, database, live_variables, sessionSettings }
