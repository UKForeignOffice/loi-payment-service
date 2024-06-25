const axios = require('axios');
const payment = require('../config/payment');

const emailService = {
    additionalPaymentReceipt: function(email, dateOfPayment, pspReference, serviceSlug, paymentAmount, paymentMethod){
        const url = payment.configs.notificationServiceURL + '/additional-payment-receipt';
        const postData = {
            to: email,
            dateOfPayment: dateOfPayment,
            pspReference: pspReference,
            serviceSlug: serviceSlug,
            paymentAmount: paymentAmount,
            paymentMethod: paymentMethod
        };

        // Send request to notification service
        axios.post(url, postData, {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        })
            .then(response => {
                console.log(response.status, response.data);
            })
            .catch(error => {
                console.log(error.message);
            });
    }
};

module.exports = emailService;