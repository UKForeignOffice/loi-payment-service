var supertest = require('supertest');
var should = require('should');

// get the code to test
//var smartPayFunctions = require('../lib/smartpay-functions.js');

// point test to where service is running
//server = supertest.agent('http://localhost:4321/api/payment');

var baseUrl = 'http://localhost:4321/api/payment';
//var server = request.agent(baseUrl);

describe('Work with Payments', function () {
    it('runs health check', function (done) {
        request(baseUrl).get('/healthcheck')
            .expect(200)
            .end(function (err, res) {
                if (err) return done(err);
                expect(res.body.message).to.equal('Payment Service is running');
                done();
            });
    });
});

//describe('Payment Service', function() {
//
//    it('should return valid application data fields', function (done) {
//
//        var formFields = {};
//        var dummyAppId = 8888;
//        var dummyApplicationDetail = { payment_amount : 12.34 };
//        var dummyApplication = { unique_app_id: 1234 };
//        var dummyDocumentCount = { doc_count: 1 };

//        smartPayFunctions.addApplicationData(
//            dummyAppId,
//            formFields,
//            dummyApplicationDetail,
//            dummyApplication,
//            dummyDocumentCount, function (err, result) {
//
//            if (err) return done(err);
//
//            // should have array with inserted fields
//            result.merchantReturnData.should.equal(dummyAppId);
//            done();
//        });
//    });
//
//});
