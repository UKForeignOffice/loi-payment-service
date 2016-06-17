
var smartpay = require('./barclaycard-smartpay.js');

exports.config = function() {
    var node_env = process.env.NODE_ENV || 'development';
    return smartpay; //smartpay[node_env];
};
