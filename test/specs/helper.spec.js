import { expect } from 'chai'
import { govukPay as helper } from '../../lib/helper.js'
import { testData } from '../data/test-data.js'

describe('Helper', () => {
  describe('generates correct payload to send to GOV UK PAY', () => {
    it('generates the correct amount', () => {
      const results = helper.buildUkPayData(
        testData.formFields,
        testData.applicationDetail,
        testData.application,
        testData.usersEmail,
      )
      expect(results.amount).to.equal(3000)
    })
    it('generates the correct app reference', () => {
      const results = helper.buildUkPayData(
        testData.formFields,
        testData.applicationDetail,
        testData.application,
        testData.usersEmail,
      )
      expect(results.reference).to.equal('A-B-21-0721-0166-037C')
    })
    it('generates the correct payment description', () => {
      const results = helper.buildUkPayData(
        testData.formFields,
        testData.applicationDetail,
        testData.application,
        testData.usersEmail,
      )
      expect(results.description).to.equal('Pay to get documents legalised')
    })
    it('generates the correct return url', () => {
      const results = helper.buildUkPayData(
        testData.formFields,
        testData.applicationDetail,
        testData.application,
        testData.usersEmail,
      )
      expect(results.return_url).to.contain('/api/payment/payment-confirmation')
    })
    it('generates the correct delayed capture value', () => {
      const results = helper.buildUkPayData(
        testData.formFields,
        testData.applicationDetail,
        testData.application,
        testData.usersEmail,
      )
      expect(results.delayedCapture).to.equal(false)
    })
    it('generates the correct email address', () => {
      const results = helper.buildUkPayData(
        testData.formFields,
        testData.applicationDetail,
        testData.application,
        testData.usersEmail,
      )
      expect(results.email).to.equal('test.user@email.com')
    })
  })

  describe('generates correct payload to send to GOV UK PAY (additional payments)', () => {
    it('generates the correct amount', () => {
      const results = helper.additionalPaymentsAddBaseData(
        testData.formFields,
        testData.casebookRef,
        testData.additionalPaymentsCost,
        testData.usersEmail,
      )
      expect(results.amount).to.equal(3000)
    })
    it('generates the correct app reference', () => {
      // Since the additional payments reference number is just the unix timestamp, we'll test that the reference contains only numbers
      const results = helper.additionalPaymentsAddBaseData(
        testData.formFields,
        testData.casebookRef,
        testData.additionalPaymentsCost,
        testData.usersEmail,
      )
      const isnum = /^\d+$/.test(results.reference)
      expect(results.reference).to.be.an('String')
      expect(isnum).to.equal(true)
    })
    it('generates the correct payment description', () => {
      const results = helper.additionalPaymentsAddBaseData(
        testData.formFields,
        testData.casebookRef,
        testData.additionalPaymentsCost,
        testData.usersEmail,
      )
      expect(results.description).to.equal('Make an additional payment')
    })
    it('generates the correct return url', () => {
      const results = helper.additionalPaymentsAddBaseData(
        testData.formFields,
        testData.casebookRef,
        testData.additionalPaymentsCost,
        testData.usersEmail,
      )
      expect(results.return_url).to.contain('/api/payment/additional-payment-confirmation')
    })
    it('generates the correct delayed capture value', () => {
      const results = helper.additionalPaymentsAddBaseData(
        testData.formFields,
        testData.casebookRef,
        testData.additionalPaymentsCost,
        testData.usersEmail,
      )
      expect(results.delayedCapture).to.equal(false)
    })
    it('generates the correct email address', () => {
      const results = helper.additionalPaymentsAddBaseData(
        testData.formFields,
        testData.casebookRef,
        testData.additionalPaymentsCost,
        testData.usersEmail,
      )
      expect(results.email).to.equal('test.user@email.com')
    })
    it('generates the correct CASEBOOK ref', () => {
      const results = helper.additionalPaymentsAddBaseData(
        testData.formFields,
        testData.casebookRef,
        testData.additionalPaymentsCost,
        testData.usersEmail,
      )
      expect(results.reference).to.equal('12345')
    })

    it('generates a numeric unix timestamp reference when applicationRef is missing', () => {
      const results = helper.additionalPaymentsAddBaseData(
        {},
        null,
        testData.additionalPaymentsCost,
        testData.usersEmail,
      )
      expect(results.reference).to.match(/^\d+$/)
    })
  })

  describe('auth and session helpers', () => {
    it('loggedInStatus returns true for plain login with passport user', () => {
      const req = {
        session: {
          passport: { user: { id: '1' } },
          method: 'plain',
        },
      }
      expect(helper.loggedInStatus(req)).to.equal(true)
    })

    it('loggedInStatus returns true for totp login when second factor is complete', () => {
      const req = {
        session: {
          passport: { user: { id: '1' } },
          method: 'totp',
          secondFactorSuccess: true,
        },
      }
      expect(helper.loggedInStatus(req)).to.equal(true)
    })

    it('loggedInStatus returns false for totp login when second factor is incomplete', () => {
      const req = {
        session: {
          passport: { user: { id: '1' } },
          method: 'totp',
          secondFactorSuccess: false,
        },
      }
      expect(helper.loggedInStatus(req)).to.equal(false)
    })

    it('loggedInUserEmail returns email when session contains authenticated user and email', () => {
      const req = {
        session: {
          passport: { user: { id: '1' } },
          email: 'test.user@email.com',
        },
      }
      expect(helper.loggedInUserEmail(req)).to.equal('test.user@email.com')
    })

    it('loggedInUserEmail returns fallback when session email is unavailable', () => {
      const req = {
        session: {
          passport: { user: { id: '1' } },
          email: null,
        },
      }
      expect(helper.loggedInUserEmail(req)).to.equal('Not Logged In')
    })

    it('loggedOutUserEmail returns address email for logged-out users', () => {
      const req = {
        session: {
          user_addresses: {
            main: {
              address: {
                email: 'logged.out@email.com',
              },
            },
          },
        },
      }
      expect(helper.loggedOutUserEmail(req)).to.equal('logged.out@email.com')
    })

    it('isSessionValid returns true when appSubmittedStatus exists', () => {
      const req = { session: { appSubmittedStatus: 'complete' } }
      expect(helper.isSessionValid(req)).to.equal(true)
    })

    it('isSessionValid returns false when appSubmittedStatus is missing', () => {
      const req = { session: {} }
      expect(helper.isSessionValid(req)).to.equal(false)
    })
  })

  describe('payload boundaries', () => {
    it('buildUkPayData rounds amount to nearest penny', () => {
      const formFields = {}
      const applicationDetail = { payment_amount: '10.015' }
      const application = { unique_app_id: 'APP-123', application_id: 99 }
      const results = helper.buildUkPayData(formFields, applicationDetail, application, 'a@b.com')
      expect(results.amount).to.equal(1002)
    })
  })
})
