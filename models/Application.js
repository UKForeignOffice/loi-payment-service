
module.exports = function(sequelize, DataTypes) {

    return sequelize.define('Application', {

        application_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            _autoGenerated: true
        },
        serviceType:{
            type: DataTypes.INTEGER
        },

        unique_app_id: {
            type: DataTypes.STRING
        },
        application_reference: {
            type: DataTypes.STRING,
            allowNull: true
        },
        case_reference: {
            type: DataTypes.STRING,
            allowNull: true
        }
    });
};
