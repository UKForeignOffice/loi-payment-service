import request from 'supertest'
import { getApp as app } from '../../server.js'

describe('GET /healthcheck', () => {
  it('returns 200', (done) => {
    request(app).get('/api/payment/healthcheck').expect(200, done)
  })

  it('returns expected healthcheck payload', (done) => {
    request(app)
      .get('/api/payment/healthcheck')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect((res) => {
        if (!res.body || res.body.message !== 'Payment Service is running') {
          throw new Error('Unexpected healthcheck payload')
        }
      })
      .end(done)
  })
})

describe('GET /payment-error', () => {
  it('returns 200', (done) => {
    request(app).get('/api/payment/payment-error').expect(200, done)
  })
})

describe('GET /additional-payment-error', () => {
  it('returns 200', (done) => {
    request(app).get('/api/payment/additional-payment-error').expect(200, done)
  })
})

describe('GET /session-expired', () => {
  it('returns 200', (done) => {
    request(app).get('/api/payment/session-expired').expect(200, done)
  })

  it('renders timeout guidance', (done) => {
    request(app)
      .get('/api/payment/session-expired')
      .expect(200)
      .expect((res) => {
        if (!res.text.includes('Your application has timed out')) {
          throw new Error('Session expired page did not render expected heading')
        }
      })
      .end(done)
  })
})
