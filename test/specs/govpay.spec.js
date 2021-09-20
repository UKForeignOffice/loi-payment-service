const request = require('supertest')
const nock = require('nock')
const expect = require("chai").expect
const testData = require("../data/test-data")

describe("GOV PAY", function() {
    describe('POST success (create payment)', function () {
        it('returns 200 and with correct data', function (done) {

            nock('https://publicapi.payments.service.gov.uk')
                .post('/v1/payments/')
                .reply(200, testData.mockPostResponse);

            request('https://publicapi.payments.service.gov.uk')
                .post('/v1/payments/')
                .send({
                    "amount": 300,
                    "reference": "1626947836",
                    "description": "Make an additional payment",
                    "return_url": "http://localhost:4321/api/payment/additional-payment-confirmation",
                    "delayedCapture": false,
                    "email": "test@email.com"
                })
                .expect((res) => {
                    expect(res.body.amount).to.equal(300);
                    expect(res.body.reference).to.equal('1626947836');
                    expect(res.body.description).to.equal('Make an additional payment');
                    expect(res.body.return_url).to.equal('http://localhost:4321/api/payment/additional-payment-confirmation');
                    expect(res.body.state.status).to.equal('created');
                    expect(res.body.state.finished).to.equal(false);
                })
                .expect(200, done);
        });
    });

    describe('GET success (check payment status)', function () {
        it('returns 200 and with correct data', function (done) {

            nock('https://publicapi.payments.service.gov.uk')
                .get('/v1/payments/hu20sqlact5260q2nanm0q8u93')
                .reply(200, testData.mockGetResponse);

            request('https://publicapi.payments.service.gov.uk')
                .get('/v1/payments/hu20sqlact5260q2nanm0q8u93')
                .expect((res) => {
                    expect(res.body.created_date).to.equal('2019-07-11T10:36:26.988Z');
                    expect(res.body.amount).to.equal(3750);
                    expect(res.body.state.status).to.equal('success');
                    expect(res.body.state.finished).to.equal(true);
                    expect(res.body.reference).to.equal('12345');
                    expect(res.body.card_details.card_brand).to.equal('Visa');
                    expect(res.body.card_details.last_digits_card_number).to.equal('1234');
                    expect(res.body.delayed_capture).to.equal(false);
                })
                .expect(200, done);
        });
    });
});


