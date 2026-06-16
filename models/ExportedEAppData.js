export const ExportedEAppData = (sequelize, DataTypes) =>
  sequelize.define('ExportedEAppData', {
    application_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  })
