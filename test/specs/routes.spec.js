const request = require('supertest')
const app = require('../../server').getApp

describe('GET /healthcheck', function () {
  it('returns 200', function (done) {
    request(app).get('/api/payment/healthcheck').expect(200, done)
  })

  it('returns expected healthcheck payload', function (done) {
    request(app)
      .get('/api/payment/healthcheck')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect(function (res) {
        if (!res.body || res.body.message !== 'Payment Service is running') {
          throw new Error('Unexpected healthcheck payload')
        }
      })
      .end(done)
  })
})

describe('GET /payment-error', function () {
  it('returns 200', function (done) {
    request(app).get('/api/payment/payment-error').expect(200, done)
  })
})

describe('GET /additional-payment-error', function () {
  it('returns 200', function (done) {
    request(app).get('/api/payment/additional-payment-error').expect(200, done)
  })
})

describe('GET /session-expired', function () {
  it('returns 200', function (done) {
    request(app).get('/api/payment/session-expired').expect(200, done)
  })

  it('renders timeout guidance', function (done) {
    request(app)
      .get('/api/payment/session-expired')
      .expect(200)
      .expect(function (res) {
        if (!res.text.includes('Your application has timed out')) {
          throw new Error('Session expired page did not render expected heading')
        }
      })
      .end(done)
  })
})
