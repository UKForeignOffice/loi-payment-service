import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bodyParser from 'body-parser'
import { RedisStore } from 'connect-redis'
import cookieParser from 'cookie-parser'
import express from 'express'
import expressSession from 'express-session'
import { scheduleJob } from 'node-schedule'
import { createClient } from 'redis'
import { ApplicationRoutes } from './app/routes.js'
import { config } from './config/common.js'
import { jobs } from './config/jobs.js'
import { logger } from './config/logs.js'
import { sessionTtlMiddleware } from './lib/sessionTTL.js'
import {
  AdditionalPaymentDetails,
  Application,
  ApplicationPaymentDetails,
  ExportedApplicationData,
  ExportedEAppData,
  PaymentsCleanupJob,
  sequelize,
  UploadedDocumentUrls,
  UserDetails,
  UserDocumentCount,
} from './models/index.js'
import nunjucksSetup from './utils/nunjucksSetup.js'

const __filename = fileURLToPath(import.meta.url)
const directoryPath = path.dirname(__filename)

const app = express()

const configGovPay = config.configGovukPay
const argvPort = Number.parseInt(process.argv[2], 10)
const envPort = Number.parseInt(process.env.PORT, 10)
const serverPort = Number.isFinite(argvPort) ? argvPort : Number.isFinite(envPort) ? envPort : 3003
// =====================================
// CONFIGURATION
// =====================================

app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
)

app.use(bodyParser.json())
app.use(cookieParser())
app.set('trust proxy', 1)

// Healthcheck - responds before session to avoid creating Redis sessions
app.use((req, res, next) => {
  if (req.path === '/api/payment/healthcheck') {
    return res.json({ message: 'Payment Service is running' })
  }
  next()
})

// =====================================
// SESSION
// =====================================

const { password, port, host } = configGovPay.sessionSettings
const connectTimeout = 15000
const sessionMiddleware = expressSession.default ?? expressSession

const redisClient = createClient({
  legacyMode: true,
  password,
  socket: { connectTimeout, port, host, tls: process.env.NODE_ENV !== 'development' },
})

redisClient.connect().catch((err) => {
  logger.error('Redis client connection error:', err)
})

redisClient.on('connect', () => {
  logger.info('Redis client connected successfully')
})

redisClient.on('error', (error) => {
  logger.error('Redis client error:', error)
})

const redisStore = new RedisStore({ client: redisClient })

app.use(
  sessionMiddleware({
    store: redisStore,
    prefix: configGovPay.sessionSettings.prefix,
    saveUninitialized: false,
    secret: configGovPay.sessionSettings.secret,
    key: configGovPay.sessionSettings.key,
    resave: false,
    rolling: true,
    cookie: {
      domain: configGovPay.sessionSettings.domain,
      maxAge: configGovPay.sessionSettings.cookieMaxAge,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
    },
  }),
)

// =====================================
// VIEW AND LOCALS
// =====================================

app.use((_req, res, next) => {
  res.locals = {
    piwikID: configGovPay.live_variables.piwikId,
    feedbackURL: configGovPay.live_variables.feedbackURL,
    service_public: configGovPay.live_variables.Public,
    start_url: configGovPay.live_variables.startPageURL,
    govuk_url: configGovPay.live_variables.GOVUKURL,
  }
  next()
})

nunjucksSetup(app, path, directoryPath)

app.use(sessionTtlMiddleware(configGovPay))

app.use((_req, res, next) => {
  res.removeHeader('X-Powered-By')
  res.removeHeader('Server')
  return next()
})

// =====================================
// MODELS (Sequelize ORM)
// =====================================
app.set('models', {
  sequelize,
  Application,
  ApplicationPaymentDetails,
  UserDetails,
  UserDocumentCount,
  PaymentsCleanupJob,
  AdditionalPaymentDetails,
  ExportedEAppData,
  ExportedApplicationData,
  UploadedDocumentUrls,
})

// =====================================
// ASSETS
// =====================================
const oneDay = 24 * 60 * 60 * 1000 // 1 day in milliseconds
const oneYear = 365 * oneDay
app.use('/api/payment/', express.static(`${directoryPath}/dist`, { maxAge: oneYear }))
app.use('/api/payment/images', express.static(`${directoryPath}/app/assets/images`, { maxAge: oneDay })) //static directory for images
app.use(
  '/api/payment/assets/govuk-frontend/',
  express.static(path.join(directoryPath, 'node_modules/govuk-frontend/dist/govuk/assets'), { maxAge: oneDay }),
)

// =====================================
// ROUTES
// =====================================
const router = express.Router() //get instance of Express router

ApplicationRoutes(router, configGovPay, app) //load routes passing in app and configuration
app.use('/api/payment', router) //prefix all requests with 'api/payment'

// =====================================
// JOB SCHEDULER
// =====================================
//Schedule and run account expiry job every day

// As there are 2 instances running, we need a random time, or the job will be executed on both instances
const randomSecond = Math.floor(Math.random() * 60)
const randomMin = Math.floor(Math.random() * 60) //Math.random returns a number from 0 to < 1 (never will return 60)
const hourlyInterval = configGovPay.configs.jobScheduleHourlyInterval
const jobScheduleRandom = `${randomSecond} ${randomMin} */${hourlyInterval} * * *`
scheduleJob(jobScheduleRandom, () => {
  jobs.paymentCleanup()
})

// =====================================
// START APP
// =====================================
// START APP
// =====================================

process.on('uncaughtException', (error, origin) => {
  logger.error('----- Uncaught Exception -----')
  logger.error(error)
  logger.error('----- Exception Origin -----')
  logger.error(origin)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('----- Unhandled Rejection -----')
  logger.error(`Promise: ${promise}`)
  logger.error(`Reason: ${reason}`)
})

app.listen(serverPort)

logger.info(`Port ${process.argv[2] || process.env.PORT || 3003} is now open for connections`)
logger.info(`is-payment-service running on port: ${process.argv[2] || process.env.PORT || 3003}`)
logger.info(
  `payment cleanup job will run every ${hourlyInterval} hours at ${randomMin} minutes and ${randomSecond} seconds past the hour`,
)

export const getApp = app
