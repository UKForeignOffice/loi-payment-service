
module.exports = function(sequelize, DataTypes) {

    return sequelize.define('ApplicationPaymentDetails', {

        application_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        payment_complete: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        payment_amount: {
            type: DataTypes.DECIMAL,
            allowNull: false,
            defaultValue: 0.00
        },
        payment_reference: {
            type: DataTypes.STRING,
            allowNull: true
        },
        payment_status: {
            type: DataTypes.STRING,
            allowNull: true
        },
        oneclick_reference: {
            type: DataTypes.STRING,
            allowNull: true
        }
    });
};
