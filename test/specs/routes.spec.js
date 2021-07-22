const request = require('supertest');
const app = require("../../server").getApp;

describe('GET /healthcheck', function() {
    it('returns 200', function(done) {
        request(app)
            .get('/api/payment/healthcheck')
            .expect(200, done);
    });
});

describe('GET /error', function() {
    it('returns 200', function(done) {
        request(app)
            .get('/api/payment/error')
            .expect(200, done);
    });
});