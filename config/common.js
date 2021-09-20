
var payment = require('./payment.js');

exports.config = function() {
    var node_env = process.env.NODE_ENV || 'development';
    return payment;
};
