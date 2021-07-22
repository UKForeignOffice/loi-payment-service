const expect = require("chai").expect;
const helper = require("../../lib/helper")
const testData = require("../data/test-data")


describe("Helper", function() {
    describe("generates correct payload to send to GOV UK PAY", function () {
        it("generates the correct amount", function () {
            const results = helper.buildUkPayData(testData.formFields, testData.applicationDetail, testData.application, testData.usersEmail);
            expect(results.amount).to.equal(3000);
        });
        it("generates the correct app reference", function () {
            const results = helper.buildUkPayData(testData.formFields, testData.applicationDetail, testData.application, testData.usersEmail);
            expect(results.reference).to.equal("A-B-21-0721-0166-037C");
        });
        it("generates the correct payment description", function () {
            const results = helper.buildUkPayData(testData.formFields, testData.applicationDetail, testData.application, testData.usersEmail);
            expect(results.description).to.equal("Pay to get documents legalised");
        });
        it("generates the correct return url", function () {
            const results = helper.buildUkPayData(testData.formFields, testData.applicationDetail, testData.application, testData.usersEmail);
            expect(results.return_url).to.equal("http://localhost:4321/api/payment/payment-confirmation");
        });
        it("generates the correct delayed capture value", function () {
            const results = helper.buildUkPayData(testData.formFields, testData.applicationDetail, testData.application, testData.usersEmail);
            expect(results.delayedCapture).to.equal(false);
        });
        it("generates the correct email address", function () {
            const results = helper.buildUkPayData(testData.formFields, testData.applicationDetail, testData.application, testData.usersEmail);
            expect(results.email).to.equal("test.user@email.com");
        });
    });

    describe("generates correct payload to send to GOV UK PAY (additional payments)", function () {
        it("generates the correct amount", function () {
            const results = helper.additionalPaymentsAddBaseData(testData.formFields, testData.additionalPaymentsCost, testData.usersEmail);
            expect(results.amount).to.equal(3000);
        });
        it("generates the correct app reference", function () {
            // Since the additional payments reference number is just the unix timestamp, we'll test that the reference contains only numbers
            const results = helper.additionalPaymentsAddBaseData(testData.formFields, testData.additionalPaymentsCost, testData.usersEmail);
            let isnum = /^\d+$/.test(results.reference);
            expect(results.reference).to.be.an('String')
            expect(isnum).to.equal(true);
        });
        it("generates the correct payment description", function () {
            const results = helper.additionalPaymentsAddBaseData(testData.formFields, testData.additionalPaymentsCost, testData.usersEmail);
            expect(results.description).to.equal("Make an additional payment");
        });
        it("generates the correct return url", function () {
            const results = helper.additionalPaymentsAddBaseData(testData.formFields, testData.additionalPaymentsCost, testData.usersEmail);
            expect(results.return_url).to.equal("http://localhost:4321/api/payment/additional-payment-confirmation");
        });
        it("generates the correct delayed capture value", function () {
            const results = helper.additionalPaymentsAddBaseData(testData.formFields, testData.additionalPaymentsCost, testData.usersEmail);
            expect(results.delayedCapture).to.equal(false);
        });
        it("generates the correct email address", function () {
            const results = helper.additionalPaymentsAddBaseData(testData.formFields, testData.additionalPaymentsCost, testData.usersEmail);
            expect(results.email).to.equal("test.user@email.com");
        });
    });
});