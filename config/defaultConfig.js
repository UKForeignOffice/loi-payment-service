export const defaultResultURL = {
  resultURL: 'http://localhost:3003/api/payment/payment-confirmation',
  additionalPaymentsReturnURL: 'http://localhost:3003/api/payment/additional-payment-confirmation',
}

export const defaultDBConfig = {
  database: 'postgres://postgres:password@localhost:5432/FCO-LOI-Service',
}

export const defaultNotificationServiceURL = { notificationServiceURL: 'http://localhost:3002/api/notification' }

export const defaultApplicationServiceReturnURL = {
  applicationServiceReturnUrl: 'http://localhost:3000/submit-application',
}

export const defaultStartNewApplicationURL = {
  startNewApplicationUrl: 'http://localhost:3000',
}

export const defaultCookieDomain = { cookieDomain: '' }

export const defaultLiveVariables = {
  Public: false,
  startPageURL: 'https://www.gov.uk/get-document-legalised',
  GOVUKURL: 'https://www.gov.uk/',
  piwikId: '18',
  feedbackURL: 'https://www.smartsurvey.co.uk/s/legalisation/',
}

export const defaultTheSession = {
  secret: 'fake-secret',
  adapter: 'connect-redis',
  host: 'localhost',
  port: 6379,
  password: '',
  prefix: 'sess:',
  key: 'express.sid',
  domain: 'http://localhost/',
  cookieMaxAge: 5200000,
}

export const defaultUKPayApiKey = {
  ukPayApiKey: 'fake-api-key',
}

export const defaultUKPayUrl = { ukPayUrl: 'https://publicapi.payments.service.gov.uk/v1/payments/' }

export const defaultJobScheduleHourlyInterval = { jobScheduleHourlyInterval: 1 }
