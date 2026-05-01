import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { getApp as app } from '../../../server.js'

describe('GET /healthcheck', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/api/payment/healthcheck')
    expect(res.status).toBe(200)
  })

  it('returns expected healthcheck payload', async () => {
    const res = await request(app).get('/api/payment/healthcheck').expect('Content-Type', /json/)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Payment Service is running')
  })
})

describe('GET /payment-error', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/api/payment/payment-error')
    expect(res.status).toBe(200)
  })
})

describe('GET /additional-payment-error', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/api/payment/additional-payment-error')
    expect(res.status).toBe(200)
  })
})

describe('GET /session-expired', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/api/payment/session-expired')
    expect(res.status).toBe(200)
  })

  it('renders timeout guidance', async () => {
    const res = await request(app).get('/api/payment/session-expired')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Your application has timed out')
  })
})
