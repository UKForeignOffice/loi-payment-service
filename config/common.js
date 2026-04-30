var payment = require('./payment.js')

exports.config = () => {
  var _node_env = process.env.NODE_ENV || 'development'
  return payment
}
