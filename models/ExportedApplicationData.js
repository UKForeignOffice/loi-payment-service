module.exports = (sequelize, DataTypes) =>
  sequelize.define('ExportedApplicationData', {
    application_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  })
