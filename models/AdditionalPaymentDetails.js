
module.exports = function(sequelize, DataTypes) {

    return sequelize.define('AdditionalPaymentDetails', {

        application_id: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        payment_reference: {
            type: DataTypes.STRING,
            allowNull: true
        },
        payment_amount: {
            type: DataTypes.DECIMAL,
            allowNull: false,
            defaultValue: 0.00
        },
        payment_status: {
            type: DataTypes.STRING,
            allowNull: true
        },
        payment_complete: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        created_at: {
            type: 'TIMESTAMP',
            allowNull: true
        },
        updated_at: {
            type: 'TIMESTAMP',
            allowNull: true
        },
        submitted: {
            type: DataTypes.STRING,
            allowNull: true
        },
        submission_attempts: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        casebook_response_code: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        timestamps: false
    });
};
