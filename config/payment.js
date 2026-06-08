import { config as dotenvConfig } from 'dotenv'
import {
  defaultApplicationServiceReturnURL,
  defaultCookieDomain,
  defaultDBConfig,
  defaultJobScheduleHourlyInterval,
  defaultLiveVariables,
  defaultNotificationServiceURL,
  defaultResultURL,
  defaultStartNewApplicationURL,
  defaultTheSession,
  defaultUKPayApiKey,
  defaultUKPayUrl,
} from './defaultConfig.js'

dotenvConfig({ silent: true })

const resultURL = { ...defaultResultURL, ...(process.env.RESULTURL ? JSON.parse(process.env.RESULTURL) : {}) }

const notificationServiceURL = {
  ...defaultNotificationServiceURL,
  ...(process.env.NOTIFICATIONSERVICEURL ? JSON.parse(process.env.NOTIFICATIONSERVICEURL) : {}),
}

const applicationServiceReturnUrl = {
  ...defaultApplicationServiceReturnURL,
  ...(process.env.APPLICATIONSERVICERETURNURL ? JSON.parse(process.env.APPLICATIONSERVICERETURNURL) : {}),
}

const startNewApplicationUrl = {
  ...defaultStartNewApplicationURL,
  ...(process.env.STARTNEWAPPLICATIONURL ? JSON.parse(process.env.STARTNEWAPPLICATIONURL) : {}),
}

const cookieDomain = {
  ...defaultCookieDomain,
  ...(process.env.COOKIEDOMAIN ? JSON.parse(process.env.COOKIEDOMAIN) : {}),
}

const db = {
  ...defaultDBConfig,
  ...(process.env.DATABASE ? JSON.parse(process.env.DATABASE) : {}),
}

const live_variables = {
  ...defaultLiveVariables,
  ...(process.env.LIVEVARIABLES ? JSON.parse(process.env.LIVEVARIABLES) : {}),
}

const sessionSettings = {
  ...defaultTheSession,
  ...(process.env.THESESSION ? JSON.parse(process.env.THESESSION) : {}),
}

const ukPayUrl = {
  ...defaultUKPayUrl,
  ...(process.env.UKPAYURL ? JSON.parse(process.env.UKPAYURL) : {}),
}
const ukPayApiKey = {
  ...defaultUKPayApiKey,
  ...(process.env.UKPAYAPIKEY ? JSON.parse(process.env.UKPAYAPIKEY) : {}),
}
const jobScheduleHourlyInterval = {
  ...defaultJobScheduleHourlyInterval,
  ...(process.env.JOBSCHEDULEHOURLYINTERVAL ? JSON.parse(process.env.JOBSCHEDULEHOURLYINTERVAL) : {}),
}
const nodeEnv = process.env.NODE_ENV || 'production'
const s3Bucket = process.env.S3_BUCKET

const configs = {
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

const database = db.database

export const paymentConfig = { configs, database, live_variables, sessionSettings }
