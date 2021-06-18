
var {Sequelize, DataTypes} = require('sequelize');

// get environment specific config
var commonConfig = require('../config/common.js');
var environmentConfig = commonConfig.config();

// database options
var opts = {
    define: {
        //prevent sequelize from pluralizing table names
        freezeTableName: true
    }
};

// initialise Sequelize
var sequelize = new Sequelize(environmentConfig.database, opts);

module.exports.sequelize = sequelize;
module.exports.Application = require('./Application')(sequelize, DataTypes)
module.exports.ApplicationPaymentDetails = require('./ApplicationPaymentDetails')(sequelize, DataTypes)
module.exports.UserDetails = require('./UserDetails')(sequelize, DataTypes)
module.exports.UserDocumentCount = require('./UserDocumentCount')(sequelize, DataTypes)