import { DataTypes, Sequelize } from 'sequelize'
import { config as environmentConfig } from '../config/common.js'
import { logger } from '../config/logs.js'
import { AdditionalPaymentDetails as AdditionalPaymentDetailsModel } from './AdditionalPaymentDetails.js'
import { Application as ApplicationModel } from './Application.js'
import { ApplicationPaymentDetails as ApplicationPaymentDetailsModel } from './ApplicationPaymentDetails.js'
import { ExportedApplicationData as ExportedApplicationDataModel } from './ExportedApplicationData.js'
import { ExportedEAppData as ExportedEAppDataModel } from './ExportedEAppData.js'
import { PaymentsCleanupJob as PaymentsCleanupJobModel } from './PaymentsCleanupJob.js'
import { UploadedDocumentUrls as UploadedDocumentUrlsModel } from './UploadedDocumentUrls.js'
import { UserDetails as UserDetailsModel } from './UserDetails.js'
import { UserDocumentCount as UserDocumentCountModel } from './UserDocumentCount.js'

//database options
const opts = {
  define: {
    //prevent sequelize from pluralizing table names
    freezeTableName: true,
  },
  retry: {
    base: 1000,
    multiplier: 2,
    max: 5000,
  },
}

logger.info(
  `initialising Sequelize with database config: ${environmentConfig.configGovukPay.database}`,
  'and options: ',
  opts,
)
// initialise Sequelize
export const sequelize = new Sequelize(environmentConfig.configGovukPay.database, opts)

export const Application = ApplicationModel(sequelize, DataTypes)
export const ApplicationPaymentDetails = ApplicationPaymentDetailsModel(sequelize, DataTypes)
export const UserDetails = UserDetailsModel(sequelize, DataTypes)
export const UserDocumentCount = UserDocumentCountModel(sequelize, DataTypes)
export const PaymentsCleanupJob = PaymentsCleanupJobModel(sequelize, DataTypes)
export const AdditionalPaymentDetails = AdditionalPaymentDetailsModel(sequelize, DataTypes)
export const ExportedEAppData = ExportedEAppDataModel(sequelize, DataTypes)
export const ExportedApplicationData = ExportedApplicationDataModel(sequelize, DataTypes)
export const UploadedDocumentUrls = UploadedDocumentUrlsModel(sequelize, DataTypes)
