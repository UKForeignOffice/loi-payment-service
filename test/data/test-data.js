const formFields = {}
const applicationDetail = {
        "id": 9170,
        "application_id": 10836,
        "payment_complete": false,
        "payment_amount": "30.00",
        "payment_reference": "v2sdjm9910dv3ldvm7s6u4qmci",
        "payment_status": null,
        "oneclick_reference": "FCO-LOI-REF-162",
        "createdAt": "2021-07-20T23:00:00.000Z",
        "updatedAt": "2021-07-20T23:00:00.000Z"
    }
const application = {
        "application_id": 10836,
        "serviceType": 3,
        "unique_app_id": "A-B-21-0721-0166-037C",
        "application_reference": null,
        "case_reference": null,
        "createdAt": "2021-07-20T23:00:00.000Z",
        "updatedAt": "2021-07-20T23:00:00.000Z"
    }
const usersEmail = "test.user@email.com"
const additionalPaymentsCost = "30"
const mockPostResponse = {
        "created_date": "2021-07-22T16:17:19.554Z",
        "state": {
                "status": "created",
                "finished": false,
        },
        "_links": {
                "self": {
                        "href": "https://publicapi.payments.service.gov.uk/v1/payments/hu20sqlact5260q2nanm0q8u93",
                        "method": "GET"
                },
                "next_url": {
                        "href": "https://publicapi.payments.service.gov.uk/secure/bb0a272c-8eaf-468d-b3xf-ae5e000d2231",
                        "method": "GET"
                },
        },
        "amount": 300,
        "reference": "1626947836",
        "description": "Make an additional payment",
        "return_url": "http://localhost:4321/api/payment/additional-payment-confirmation",
        "payment_id": "hu20sqlact5260q2nanm0q8u93",
        "payment_provider": "worldpay",
        "provider_id": "10987654321",
}
const mockGetResponse = {
        "created_date": "2019-07-11T10:36:26.988Z",
        "amount": 3750,
        "state": {
                "status": "success",
                "finished": true,
        },
        "description": "Pay your council tax",
        "reference": "12345",
        "language": "en",
        "metadata": {
                "ledger_code": "AB100",
                "an_internal_reference_number": 200
        },
        "email": "sherlock.holmes@example.com",
        "card_details": {
                "card_brand": "Visa",
                "card_type": "debit",
                "last_digits_card_number": "1234",
                "first_digits_card_number": "123456",
                "expiry_date": "04/24",
                "cardholder_name": "Sherlock Holmes",
                "billing_address": {
                        "line1": "221 Baker Street",
                        "line2": "Flat b",
                        "postcode": "NW1 6XE",
                        "city": "London",
                        "country": "GB"
                }
        },
        "payment_id": "hu20sqlact5260q2nanm0q8u93",
        "refund_summary": {
                "status": "available",
                "amount_available": 4000,
                "amount_submitted": 0
        },
        "settlement_summary": {
                "capture_submit_time": "2019-07-12T17:15:000Z",
                "captured_date": "2019-07-12",
                "settled_date": "2019-07-12"
        },
        "delayed_capture": false,
        "moto": false,
        "corporate_card_surcharge": 250,
        "total_amount": 4000,
        "fee": 200,
        "net_amount": 3800,
        "payment_provider": "worldpay",
        "provider_id": "10987654321",
        "return_url": "https://your.service.gov.uk/completed"
}

module.exports = {
        formFields,
        applicationDetail,
        application,
        usersEmail,
        additionalPaymentsCost,
        mockPostResponse,
        mockGetResponse
}