/**
 * Created by seanm on 06/05/2020.
 */
var payment = require('../config/payment');
var request = require('request'),

    emailService = {
        additionalPaymentReceipt: function(email, dateOfPayment, pspReference, serviceSlug, paymentAmount, paymentMethod){
            var url = '/additional-payment-receipt';
            var postData = {
                to: email,
                dateOfPayment: dateOfPayment,
                pspReference: pspReference,
                serviceSlug: serviceSlug,
                paymentAmount: paymentAmount,
                paymentMethod: paymentMethod
            };

            // send request to notification service
            request(setOptions(postData, url), function (err, res, body) {
                if(err) {
                    console.log(err);
                } else {
                    console.log(res.statusCode, body);
                }
            });
        }
    };

module.exports = emailService;

function setOptions(postData, url){
    var options = {
        url: payment.configs.notificationServiceURL + url,
        headers:
            {
                'cache-control': 'no-cache',
                'content-type': 'application/json'
            },
        method: 'POST',
        json: true,
        body: postData
    };
    return options;
}
