import { config as dotenvConfig } from 'dotenv'
import {
  defaultApplicationServiceReturnURL,
  defaultDBConfig,
  defaultNotificationServiceURL,
  defaultResultURL,
  defaultStartNewApplicationURL,
  defaultCookieDomain,
  defaultLiveVariables,
  defaultTheSession,
  defaultUKPayApiKey,
  defaultUKPayUrl,
  defaultJobScheduleHourlyInterval,
} from './defaultConfig.js'

dotenvConfig()

var resultURL = { ...defaultResultURL, ...(process.env.RESULTURL ? JSON.parse(process.env.RESULTURL) : {}) }

var notificationServiceURL = {
  ...defaultNotificationServiceURL,
  ...(process.env.NOTIFICATIONSERVICEURL ? JSON.parse(process.env.NOTIFICATIONSERVICEURL) : {}),
}

var applicationServiceReturnUrl = {
  ...defaultApplicationServiceReturnURL,
  ...(process.env.APPLICATIONSERVICERETURNURL ? JSON.parse(process.env.APPLICATIONSERVICERETURNURL) : {}),
}

var startNewApplicationUrl = {
  ...defaultStartNewApplicationURL,
  ...(process.env.STARTNEWAPPLICATIONURL ? JSON.parse(process.env.STARTNEWAPPLICATIONURL) : {}),
}

var cookieDomain = {
  ...defaultCookieDomain,
  ...(process.env.COOKIEDOMAIN ? JSON.parse(process.env.COOKIEDOMAIN) : {}),
}

var db = {
  ...defaultDBConfig,
  ...(process.env.EDMS_BEARER_TOKEN ? JSON.parse(process.env.EDMS_BEARER_TOKEN) : {}),
}

var live_variables = {
  ...defaultLiveVariables,
  ...(process.env.LIVEVARIABLES ? JSON.parse(process.env.LIVEVARIABLES) : {}),
}

var sessionSettings = {
  ...defaultTheSession,
  ...(process.env.THESESSION ? JSON.parse(process.env.THESESSION) : {}),
}

var ukPayUrl = {
  ...defaultUKPayUrl,
  ...(process.env.UKPAYURL ? JSON.parse(process.env.UKPAYURL) : {}),
}
var ukPayApiKey = {
  ...defaultUKPayApiKey,
  ...(process.env.UKPAYAPIKEY ? JSON.parse(process.env.UKPAYAPIKEY) : {}),
}
var jobScheduleHourlyInterval = {
  ...defaultJobScheduleHourlyInterval,
  ...(process.env.JOBSCHEDULEHOURLYINTERVAL ? JSON.parse(process.env.JOBSCHEDULEHOURLYINTERVAL) : {}),
}
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
