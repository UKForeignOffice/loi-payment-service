
module.exports = function(sequelize, DataTypes) {

    return sequelize.define('ExportedEAppData', {

        application_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        }
    });
};
