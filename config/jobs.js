var Model = require('../models/index'),
    common = require('./common.js'),
    moment = require('moment'),
    envVariables = common.config();

var jobs ={
    paymentCleanup: function() {

        let formattedDate = moment().toISOString();

        try {

            console.log('['+formattedDate+'][PAYMENT CLEANUP JOB] STARTED');

            Model.ApplicationPaymentDetails.findAll({
                where:{
                    payment_status:null,
                    payment_complete:false,
                    payment_reference:{
                        $ne: null
                    },
                    createdAt: {
                        $gte: moment().subtract(3, 'days').toDate()
                    }
                }
            }).then(function(data) {
                console.log(JSON.stringify(data))
            })

        } catch (error) {

            console.log(error)

        } finally {


        }

    }
};
module.exports = jobs;
