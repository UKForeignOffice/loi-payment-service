const request = require('supertest');
const app = require("../../server").getApp;

describe('GET /healthcheck', function() {
    it('returns 200', function(done) {
        request(app)
            .get('/api/payment/healthcheck')
            .expect(200, done);
    });
});

describe('GET /payment-error', function() {
    it('returns 200', function(done) {
        request(app)
            .get('/api/payment/payment-error')
            .expect(200, done);
    });
});

describe('GET /additional-payment-error', function() {
    it('returns 200', function(done) {
        request(app)
            .get('/api/payment/additional-payment-error')
            .expect(200, done);
    });
});