
var Sequelize = require('sequelize');

// get environment specific config
var commonConfig = require('../config/common.js');
var environmentConfig = commonConfig.config();

// options
//database wide options
var opts = {
    define: {
        //prevent sequelize from pluralizing table names
        freezeTableName: true
    }
};

// initialise Sequelize
var sequelize = new Sequelize(environmentConfig.database, opts);

// load models
var models = [
    'ApplicationPaymentDetails',
    'Application',
    'UserDetails',
    'UserDocumentCount'
];
models.forEach(function(model) {
    module.exports[model] = sequelize.import(__dirname + '/' + model);
});

module.exports.sequelize = sequelize;