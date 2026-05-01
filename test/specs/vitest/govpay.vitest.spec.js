import nock from 'nock'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { testData } from '../../data/test-data.js'

describe('GOV PAY', () => {
  describe('POST success (create payment)', () => {
    it('returns 200 and with correct data', async () => {
      nock('https://publicapi.payments.service.gov.uk').post('/v1/payments/').reply(200, testData.mockPostResponse)

      const res = await request('https://publicapi.payments.service.gov.uk').post('/v1/payments/').send({
        amount: 300,
        reference: '1626947836',
        description: 'Make an additional payment',
        return_url: 'http://localhost:4321/api/payment/additional-payment-confirmation',
        delayedCapture: false,
        email: 'test@email.com',
      })

      expect(res.status).toBe(200)
      expect(res.body.amount).toBe(300)
      expect(res.body.reference).toBe('1626947836')
      expect(res.body.description).toBe('Make an additional payment')
      expect(res.body.return_url).toBe('http://localhost:4321/api/payment/additional-payment-confirmation')
      expect(res.body.state.status).toBe('created')
      expect(res.body.state.finished).toBe(false)
    })
  })

  describe('GET success (check payment status)', () => {
    it('returns 200 and with correct data', async () => {
      nock('https://publicapi.payments.service.gov.uk')
        .get('/v1/payments/hu20sqlact5260q2nanm0q8u93')
        .reply(200, testData.mockGetResponse)

      const res = await request('https://publicapi.payments.service.gov.uk').get(
        '/v1/payments/hu20sqlact5260q2nanm0q8u93',
      )

      expect(res.status).toBe(200)
      expect(res.body.created_date).toBe('2019-07-11T10:36:26.988Z')
      expect(res.body.amount).toBe(3750)
      expect(res.body.state.status).toBe('success')
      expect(res.body.state.finished).toBe(true)
      expect(res.body.reference).toBe('12345')
      expect(res.body.card_details.card_brand).toBe('Visa')
      expect(res.body.card_details.last_digits_card_number).toBe('1234')
      expect(res.body.delayed_capture).toBe(false)
    })
  })
})
