module.exports = function(sequelize, DataTypes) {

    return sequelize.define('UserDocumentCount', {

        application_id:{
            type: DataTypes.INTEGER
        },
        doc_count:{
            type: DataTypes.INTEGER
        },
        price:{
            type: DataTypes.INTEGER
        }
    });
};