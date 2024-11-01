
module.exports = function(sequelize, DataTypes) {

    return sequelize.define('ExportedApplicationData', {
        application_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        }
    });
};
