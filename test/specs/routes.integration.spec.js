import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('../../config/logs.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('../../lib/EmailService.js', () => ({
  emailService: {
    additionalPaymentReceipt: vi.fn(),
  },
}))

vi.mock('../../lib/helper.js', () => ({
  govukPay: {
    additionalPaymentsAddBaseData: vi.fn(),
    buildUkPayData: vi.fn(),
    isSessionValid: vi.fn(),
    loggedInStatus: vi.fn(),
    loggedInUserEmail: vi.fn(),
    loggedOutUserEmail: vi.fn(),
  },
}))

vi.mock('../../models/index.js', () => ({
  AdditionalPaymentDetails: {
    create: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
  },
  Application: {
    findOne: vi.fn(),
  },
  ApplicationPaymentDetails: {
    findOne: vi.fn(),
    update: vi.fn(),
  },
  UserDetails: {
    findOne: vi.fn(),
  },
  UserDocumentCount: {
    findOne: vi.fn(),
  },
}))

import axios from 'axios'
import { ApplicationRoutes } from '../../app/routes.js'
import { emailService } from '../../lib/EmailService.js'
import { govukPay } from '../../lib/helper.js'
import {
  AdditionalPaymentDetails,
  Application,
  ApplicationPaymentDetails,
  UserDetails,
  UserDocumentCount,
} from '../../models/index.js'

const configGovPay = {
  configs: {
    applicationServiceReturnUrl: 'https://app.example/return',
    startNewApplicationUrl: 'https://app.example/start',
    ukPayApiKey: 'test-api-key',
    ukPayUrl: 'https://publicapi.payments.service.gov.uk/v1/payments/',
  },
  sessionSettings: {
    cookieMaxAge: '3600000',
  },
}

let currentSession

function createSession(overrides = {}) {
  return {
    appId: 10836,
    cookie: {
      expires: new Date(Date.now() + 1000),
      maxAge: 1000,
      originalMaxAge: 1000,
    },
    save: (done) => done?.(),
    ...overrides,
  }
}

function buildApp() {
  const app = express()

  app.use(express.urlencoded({ extended: true }))
  app.use(express.json())

  app.use((req, _res, next) => {
    req.session = currentSession
    next()
  })

  app.use((req, res, next) => {
    res.render = (view, data) => {
      const safeData = data && typeof data === 'object' ? { ...data } : data
      if (safeData && typeof safeData === 'object' && 'req' in safeData) {
        safeData.req = '[request]'
      }
      return res.status(200).json({ data: safeData, view })
    }
    req.session = req.session || createSession()
    next()
  })

  const router = express.Router()
  ApplicationRoutes(router, configGovPay, app)
  app.use('/api/payment', router)

  return app
}

describe('ApplicationRoutes integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentSession = createSession()

    govukPay.loggedInStatus.mockReturnValue(true)
    govukPay.loggedInUserEmail.mockReturnValue('user@example.com')
    govukPay.loggedOutUserEmail.mockReturnValue('guest@example.com')
    govukPay.isSessionValid.mockReturnValue(true)
    govukPay.buildUkPayData.mockReturnValue({ amount: 3000, reference: 'APP-REF-1' })
    govukPay.additionalPaymentsAddBaseData.mockReturnValue({ amount: 3000, reference: '12345' })
  })

  it('renders payment error when submit-payment is called without session app id', async () => {
    currentSession = createSession({ appId: 0 })
    const app = buildApp()

    const res = await request(app).get('/api/payment/submit-payment')

    expect(res.status).toBe(200)
    expect(res.body.view).toBe('payment-error')
    expect(res.body.data.errorMessage).toBe('Missing user session')
  })

  it('redirects to existing payment url when application already has payment_url', async () => {
    const app = buildApp()
    Application.findOne.mockResolvedValue({ application_id: 10836, unique_app_id: 'APP-1' })
    ApplicationPaymentDetails.findOne.mockResolvedValue({
      application_id: 10836,
      payment_url: 'https://pay.example/existing',
    })

    const res = await request(app).get('/api/payment/submit-payment')

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('https://pay.example/existing')
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('creates payment and redirects to gov pay url for submit-payment', async () => {
    const app = buildApp()

    Application.findOne.mockResolvedValue({
      application_id: 10836,
      unique_app_id: 'APP-1',
    })

    ApplicationPaymentDetails.findOne
      .mockResolvedValueOnce({
        application_id: 10836,
        payment_amount: '30.00',
        payment_url: null,
      })
      .mockResolvedValueOnce({
        application_id: 10836,
        payment_url: 'https://pay.example/new',
      })

    axios.post.mockResolvedValue({
      data: {
        _links: { next_url: { href: 'https://pay.example/new' } },
        payment_id: 'pid-123',
      },
    })

    const res = await request(app).post('/api/payment/submit-payment')

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('https://pay.example/new')
    expect(ApplicationPaymentDetails.update).toHaveBeenCalledWith(
      {
        payment_reference: 'pid-123',
        payment_url: 'https://pay.example/new',
      },
      { where: { application_id: 10836 } },
    )
  })

  it('renders error page for payment-confirmation with non numeric id', async () => {
    const app = buildApp()

    const res = await request(app).get('/api/payment/payment-confirmation?id=abc')

    expect(res.status).toBe(200)
    expect(res.body.view).toBe('payment-error')
    expect(res.body.data.errorMessage).toBe('Invalid application reference')
  })

  it('updates payment and redirects on successful payment-confirmation', async () => {
    currentSession = createSession({ appId: 10836 })
    const app = buildApp()

    ApplicationPaymentDetails.findOne.mockResolvedValue({ payment_reference: 'pid-123' })

    axios.get.mockResolvedValue({
      data: {
        reference: 'A-B-REF-1',
        state: { finished: true, status: 'success' },
      },
    })

    const res = await request(app).get('/api/payment/payment-confirmation?id=10836')

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('https://app.example/return?id=10836&appReference=A-B-REF-1')
    expect(ApplicationPaymentDetails.update).toHaveBeenCalledWith(
      {
        payment_complete: true,
        payment_status: 'AUTHORISED',
        payment_url: null,
      },
      { where: { application_id: '10836' } },
    )
    expect(currentSession.cookie.maxAge).toBe(3600000)
  })

  it('retries payment and renders confirmation page on failed payment-confirmation', async () => {
    currentSession = createSession({
      account: { id: 'acct-1' },
      appId: 10836,
      appSubmittedStatus: 'pending',
      user: { id: 'user-1' },
    })

    const app = buildApp()

    ApplicationPaymentDetails.findOne
      .mockResolvedValueOnce({ payment_reference: 'pid-123' })
      .mockResolvedValueOnce({ application_id: 10836, payment_amount: '30.00' })

    Application.findOne.mockResolvedValue({ serviceType: 3, unique_app_id: 'APP-1' })
    UserDetails.findOne.mockResolvedValue({ id: 1 })
    UserDocumentCount.findOne.mockResolvedValue({ id: 1 })

    axios.get.mockResolvedValue({
      data: {
        reference: 'A-B-REF-1',
        state: { finished: true, status: 'failed' },
      },
    })

    axios.post.mockResolvedValue({
      data: {
        _links: { next_url: { href: 'https://pay.example/retry' } },
        payment_id: 'pid-retry',
      },
    })

    const res = await request(app).get('/api/payment/payment-confirmation?id=10836')

    expect(res.status).toBe(200)
    expect(res.body.view).toBe('payment-confirmation')
    expect(res.body.data.applicationId).toBe('10836')
    expect(res.body.data.next_url).toBe('https://pay.example/retry')
    expect(ApplicationPaymentDetails.update).toHaveBeenCalledWith(
      {
        payment_reference: 'pid-retry',
        payment_url: 'https://pay.example/retry',
      },
      { where: { application_id: '10836' } },
    )
  })

  it('renders payment-error when failed payment retry response is malformed', async () => {
    currentSession = createSession({
      account: { id: 'acct-1' },
      appId: 10836,
      appSubmittedStatus: 'pending',
      user: { id: 'user-1' },
    })

    const app = buildApp()

    ApplicationPaymentDetails.findOne
      .mockResolvedValueOnce({ payment_reference: 'pid-123' })
      .mockResolvedValueOnce({ application_id: 10836, payment_amount: '30.00' })

    Application.findOne.mockResolvedValue({ serviceType: 3, unique_app_id: 'APP-1' })
    UserDetails.findOne.mockResolvedValue({ id: 1 })
    UserDocumentCount.findOne.mockResolvedValue({ id: 1 })

    axios.get.mockResolvedValue({
      data: {
        reference: 'A-B-REF-1',
        state: { finished: true, status: 'failed' },
      },
    })

    axios.post.mockResolvedValue({
      data: {
        payment_id: 'pid-retry',
      },
    })

    const res = await request(app).get('/api/payment/payment-confirmation?id=10836')

    expect(res.status).toBe(200)
    expect(res.body.view).toBe('payment-error')
    expect(res.body.data.errorMessage).toBe('Error processing payment retry')
  })

  it('renders payment-error when failed payment retry throws', async () => {
    currentSession = createSession({
      account: { id: 'acct-1' },
      appId: 10836,
      appSubmittedStatus: 'pending',
      user: { id: 'user-1' },
    })

    const app = buildApp()

    ApplicationPaymentDetails.findOne
      .mockResolvedValueOnce({ payment_reference: 'pid-123' })
      .mockResolvedValueOnce({ application_id: 10836, payment_amount: '30.00' })

    Application.findOne.mockResolvedValue({ serviceType: 3, unique_app_id: 'APP-1' })
    UserDetails.findOne.mockResolvedValue({ id: 1 })
    UserDocumentCount.findOne.mockResolvedValue({ id: 1 })

    axios.get.mockResolvedValue({
      data: {
        reference: 'A-B-REF-1',
        state: { finished: true, status: 'failed' },
      },
    })

    axios.post.mockRejectedValue(new Error('retry post failed'))

    const res = await request(app).get('/api/payment/payment-confirmation?id=10836')

    expect(res.status).toBe(200)
    expect(res.body.view).toBe('payment-error')
    expect(res.body.data.errorMessage).toBe('Error processing payment retry')
  })

  it('renders additional payment error when gov pay payload is invalid', async () => {
    currentSession = createSession({
      additionalPayments: {
        applicationAmount: '30',
        applicationEmail: 'addl@example.com',
        applicationRef: '12345',
      },
    })
    const app = buildApp()

    axios.post.mockResolvedValue({ data: { payment_id: 'pid-123' } })

    const res = await request(app).post('/api/payment/submit-additional-payment')

    expect(res.status).toBe(200)
    expect(res.body.view).toBe('additional-payment-error')
    expect(res.body.data.errorMessage).toBe('Invalid Gov Pay return data')
  })

  it('creates additional payment draft and renders redirect page', async () => {
    currentSession = createSession({
      additionalPayments: {
        applicationAmount: '30',
        applicationEmail: 'addl@example.com',
        applicationRef: '12345',
      },
    })
    const app = buildApp()

    AdditionalPaymentDetails.findOne.mockResolvedValue(null)
    axios.post.mockResolvedValue({
      data: {
        _links: { next_url: { href: 'https://pay.example/additional' } },
        amount: 3000,
        created_date: '2025-01-01T12:00:00Z',
        payment_id: 'addl-pid-1',
        reference: '12345',
        state: { status: 'created' },
      },
    })

    const res = await request(app).post('/api/payment/submit-additional-payment')

    expect(res.status).toBe(200)
    expect(res.body.view).toBe('additionalPayments/submit-additional-payment')
    expect(res.body.data.next_url).toBe('https://pay.example/additional')
    expect(currentSession.additionalPayments.paymentReference).toBe('addl-pid-1')
    expect(AdditionalPaymentDetails.create).toHaveBeenCalled()
  })

  it('renders successful additional-payment-confirmation and sends receipt', async () => {
    currentSession = createSession({
      additionalPayments: {
        applicationAmount: '30',
        applicationEmail: 'addl@example.com',
        applicationRef: '12345',
        paymentReference: 'addl-pid-1',
      },
    })

    const app = buildApp()

    AdditionalPaymentDetails.update.mockResolvedValue([1])

    axios.get.mockResolvedValue({
      data: {
        amount: 3000,
        card_details: { card_brand: 'Visa' },
        created_date: '2025-01-01T12:00:00Z',
        reference: '12345',
        state: {
          finished: true,
          status: 'success',
        },
      },
    })

    const res = await request(app).get('/api/payment/additional-payment-confirmation')

    expect(res.status).toBe(200)
    expect(res.body.view).toBe('additionalPayments/additional-payment-confirmation')
    expect(res.body.data.paymentSuccessful).toBe(true)
    expect(AdditionalPaymentDetails.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_complete: true,
        payment_reference: 'addl-pid-1',
        payment_status: 'AUTHORISED',
      }),
      { where: { application_id: '12345' } },
    )
    expect(emailService.additionalPaymentReceipt).toHaveBeenCalled()
    expect(currentSession.cookie.maxAge).toBe(3600000)
  })

  it('renders additional-payment-error when failed additional retry returns invalid gov pay data', async () => {
    currentSession = createSession({
      additionalPayments: {
        applicationAmount: '30',
        applicationEmail: 'addl@example.com',
        applicationRef: '12345',
        paymentReference: 'addl-pid-1',
      },
    })

    const app = buildApp()

    axios.get.mockResolvedValue({
      data: {
        amount: 3000,
        created_date: '2025-01-01T12:00:00Z',
        reference: '12345',
        state: {
          finished: true,
          status: 'failed',
        },
      },
    })

    axios.post.mockResolvedValue({
      data: {
        payment_id: 'retry-additional-1',
      },
    })

    const res = await request(app).get('/api/payment/additional-payment-confirmation')

    expect(res.status).toBe(200)
    expect(res.body.view).toBe('additional-payment-error')
    expect(res.body.data.errorMessage).toBe('Invalid Gov Pay return data')
  })

  it('renders additional-payment-error when failed additional retry throws', async () => {
    currentSession = createSession({
      additionalPayments: {
        applicationAmount: '30',
        applicationEmail: 'addl@example.com',
        applicationRef: '12345',
        paymentReference: 'addl-pid-1',
      },
    })

    const app = buildApp()

    axios.get.mockResolvedValue({
      data: {
        amount: 3000,
        created_date: '2025-01-01T12:00:00Z',
        reference: '12345',
        state: {
          finished: true,
          status: 'failed',
        },
      },
    })

    axios.post.mockRejectedValue(new Error('additional retry failed'))

    const res = await request(app).get('/api/payment/additional-payment-confirmation')

    expect(res.status).toBe(200)
    expect(res.body.view).toBe('additional-payment-error')
    expect(res.body.data.errorMessage).toBe('additional retry failed')
  })
})
