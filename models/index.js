
const {Sequelize, DataTypes} = require('sequelize');

// get environment specific config
const commonConfig = require('../config/common.js');
const environmentConfig = commonConfig.config();

//database options
const opts = {
    define: {
        //prevent sequelize from pluralizing table names
        freezeTableName: true
    }
};

// initialise Sequelize
const sequelize = new Sequelize(environmentConfig.database, opts);

module.exports.sequelize = sequelize;
module.exports.Application = require('./Application')(sequelize, DataTypes)
module.exports.ApplicationPaymentDetails = require('./ApplicationPaymentDetails')(sequelize, DataTypes)
module.exports.UserDetails = require('./UserDetails')(sequelize, DataTypes)
module.exports.UserDocumentCount = require('./UserDocumentCount')(sequelize, DataTypes)
module.exports.PaymentsCleanupJob = require('./PaymentsCleanupJob')(sequelize, DataTypes)
module.exports.AdditionalPaymentDetails = require('./AdditionalPaymentDetails')(sequelize, DataTypes)
