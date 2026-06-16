import moment from 'moment'
import { config } from '../config/common.js'
import { logger } from '../config/logs.js'

const configGovPay = config.configGovukPay

export const govukPay = {
  buildUkPayData: (formFields, applicationDetail, application, usersEmail) => {
    formFields.amount = Math.round(applicationDetail.payment_amount * 1e2)
    formFields.reference = application.unique_app_id
    formFields.description = 'Pay to get documents legalised'
    formFields.return_url = `${configGovPay.configs.resultURL}?id=${application.application_id}`
    formFields.delayedCapture = false
    formFields.email = usersEmail
    return formFields
  },

  loggedInStatus: function amILoggedIn(req) {
    return !!(
      req.session?.passport?.user &&
      (req.session.method === 'plain' || (req.session.method === 'totp' && req.session.secondFactorSuccess === true))
    )
  },

  loggedInUserEmail: function whatsUsersEmail(req) {
    if (req.session?.passport?.user && req.session.email && req.session.email !== null) {
      return req.session.email
    } else {
      return 'Not Logged In'
    }
  },

  loggedOutUserEmail: function getUserEmail(req) {
    if (typeof req.session.user_addresses.main.address.email !== 'undefined') {
      return req.session.user_addresses.main.address.email
    } else {
      return ''
    }
  },

  isSessionValid: function getSomeSessionInfo(req) {
    if (typeof req.session.appSubmittedStatus !== 'undefined') {
      logger.info('session is valid - proceed to payment unsuccessful page')
      return true
    } else {
      logger.info('session is invalid - proceed to session expiry page')
      return false
    }
  },

  additionalPaymentsAddBaseData: (formFields, applicationRef, cost, email) => {
    formFields.amount = Math.round(cost * 1e2)
    formFields.reference = applicationRef ? applicationRef : moment().unix().toString()
    formFields.description = 'Make an additional payment'
    formFields.return_url = configGovPay.configs.additionalPaymentsReturnURL
    formFields.delayedCapture = false
    formFields.email = email
    return formFields
  },
}
