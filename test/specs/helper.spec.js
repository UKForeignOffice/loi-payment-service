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
            expect(results.return_url).to.contain("/api/payment/payment-confirmation")
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
            const results = helper.additionalPaymentsAddBaseData(testData.formFields, testData.casebookRef, testData.additionalPaymentsCost, testData.usersEmail);
            expect(results.amount).to.equal(3000);
        });
        it("generates the correct app reference", function () {
            // Since the additional payments reference number is just the unix timestamp, we'll test that the reference contains only numbers
            const results = helper.additionalPaymentsAddBaseData(testData.formFields, testData.casebookRef, testData.additionalPaymentsCost, testData.usersEmail);
            let isnum = /^\d+$/.test(results.reference);
            expect(results.reference).to.be.an('String')
            expect(isnum).to.equal(true);
        });
        it("generates the correct payment description", function () {
            const results = helper.additionalPaymentsAddBaseData(testData.formFields, testData.casebookRef, testData.additionalPaymentsCost, testData.usersEmail);
            expect(results.description).to.equal("Make an additional payment");
        });
        it("generates the correct return url", function () {
            const results = helper.additionalPaymentsAddBaseData(testData.formFields, testData.casebookRef, testData.additionalPaymentsCost, testData.usersEmail);
            expect(results.return_url).to.contain("/api/payment/additional-payment-confirmation");
        });
        it("generates the correct delayed capture value", function () {
            const results = helper.additionalPaymentsAddBaseData(testData.formFields, testData.casebookRef, testData.additionalPaymentsCost, testData.usersEmail);
            expect(results.delayedCapture).to.equal(false);
        });
        it("generates the correct email address", function () {
            const results = helper.additionalPaymentsAddBaseData(testData.formFields, testData.casebookRef, testData.additionalPaymentsCost, testData.usersEmail);
            expect(results.email).to.equal("test.user@email.com");
        });
        it("generates the correct CASEBOOK ref", function () {
            const results = helper.additionalPaymentsAddBaseData(testData.formFields, testData.casebookRef, testData.additionalPaymentsCost, testData.usersEmail);
            expect(results.reference).to.equal("12345");
        });

        it("generates a numeric unix timestamp reference when applicationRef is missing", function () {
            const results = helper.additionalPaymentsAddBaseData({}, null, testData.additionalPaymentsCost, testData.usersEmail);
            expect(results.reference).to.match(/^\d+$/);
        });
    });

    describe("auth and session helpers", function () {
        it("loggedInStatus returns true for plain login with passport user", function () {
            const req = {
                session: {
                    passport: { user: { id: "1" } },
                    method: "plain"
                }
            };
            expect(helper.loggedInStatus(req)).to.equal(true);
        });

        it("loggedInStatus returns true for totp login when second factor is complete", function () {
            const req = {
                session: {
                    passport: { user: { id: "1" } },
                    method: "totp",
                    secondFactorSuccess: true
                }
            };
            expect(helper.loggedInStatus(req)).to.equal(true);
        });

        it("loggedInStatus returns false for totp login when second factor is incomplete", function () {
            const req = {
                session: {
                    passport: { user: { id: "1" } },
                    method: "totp",
                    secondFactorSuccess: false
                }
            };
            expect(helper.loggedInStatus(req)).to.equal(false);
        });

        it("loggedInUserEmail returns email when session contains authenticated user and email", function () {
            const req = {
                session: {
                    passport: { user: { id: "1" } },
                    email: "test.user@email.com"
                }
            };
            expect(helper.loggedInUserEmail(req)).to.equal("test.user@email.com");
        });

        it("loggedInUserEmail returns fallback when session email is unavailable", function () {
            const req = {
                session: {
                    passport: { user: { id: "1" } },
                    email: null
                }
            };
            expect(helper.loggedInUserEmail(req)).to.equal("Not Logged In");
        });

        it("loggedOutUserEmail returns address email for logged-out users", function () {
            const req = {
                session: {
                    user_addresses: {
                        main: {
                            address: {
                                email: "logged.out@email.com"
                            }
                        }
                    }
                }
            };
            expect(helper.loggedOutUserEmail(req)).to.equal("logged.out@email.com");
        });

        it("isSessionValid returns true when appSubmittedStatus exists", function () {
            const req = { session: { appSubmittedStatus: "complete" } };
            expect(helper.isSessionValid(req)).to.equal(true);
        });

        it("isSessionValid returns false when appSubmittedStatus is missing", function () {
            const req = { session: {} };
            expect(helper.isSessionValid(req)).to.equal(false);
        });
    });

    describe("payload boundaries", function () {
        it("buildUkPayData rounds amount to nearest penny", function () {
            const formFields = {};
            const applicationDetail = { payment_amount: "10.015" };
            const application = { unique_app_id: "APP-123", application_id: 99 };
            const results = helper.buildUkPayData(formFields, applicationDetail, application, "a@b.com");
            expect(results.amount).to.equal(1002);
        });
    });
});
