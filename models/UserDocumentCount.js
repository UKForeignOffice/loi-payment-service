export const UserDocumentCount = (sequelize, DataTypes) =>
  sequelize.define('UserDocumentCount', {
    application_id: {
      type: DataTypes.INTEGER,
    },
    doc_count: {
      type: DataTypes.INTEGER,
    },
    price: {
      type: DataTypes.INTEGER,
    },
  })
