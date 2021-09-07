
module.exports = function(sequelize, DataTypes) {

    return sequelize.define('PaymentsCleanupJob', {

        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        lock: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        timestamps: false
    });
};
