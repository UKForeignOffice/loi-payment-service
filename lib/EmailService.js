import axios from 'axios'
import { logger } from '../config/logs.js'
import { paymentConfig } from '../config/payment.js'

export const emailService = {
  additionalPaymentReceipt: (email, dateOfPayment, pspReference, serviceSlug, paymentAmount, paymentMethod) => {
    const url = `${paymentConfig.configs.notificationServiceURL}/additional-payment-receipt`
    const postData = {
      to: email,
      dateOfPayment: dateOfPayment,
      pspReference: pspReference,
      serviceSlug: serviceSlug,
      paymentAmount: paymentAmount,
      paymentMethod: paymentMethod,
    }

    // Send request to notification service
    axios
      .post(url, postData, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      })
      .then((response) => {
        logger.info(`${response.status} - ${response.data}`)
      })
      .catch((error) => {
        logger.error(error.message)
      })
  },
}
