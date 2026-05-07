import nunjucks from 'nunjucks'
import { config } from '../config/common.js'

const configGovPay = config.configGovukPay

export default function setupNunjucks(app, path, directoryPath) {
  app.engine('njk', nunjucks.render)

  app.locals.globals = {
    ...app.locals,
    piwikID: configGovPay.live_variables.piwikId,
    feedbackURL: configGovPay.live_variables.feedbackURL,
    service_public: configGovPay.live_variables.Public,
    start_url: configGovPay.live_variables.startPageURL,
    govuk_url: configGovPay.live_variables.GOVUKURL,
  }

  const _njkEnv = nunjucks.configure(
    [
      path.join(directoryPath, 'views'),
      'node_modules/govuk-frontend/dist',
      'node_modules/govuk-frontend/dist/components/',
    ],
    {
      autoescape: true,
      express: app,
      watch: true,
    },
  )
}
