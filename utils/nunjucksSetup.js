import fs from 'node:fs'
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

  const njkEnv = nunjucks.configure(
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

  const manifestPath = path.join(directoryPath, 'dist', 'manifest.json')

  let manifestCache = null

  function getManifest() {
    if (manifestCache) return manifestCache
    try {
      manifestCache = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    } catch {
      manifestCache = {}
    }
    return manifestCache
  }

  njkEnv.addGlobal('hashedAsset', (fileName) => {
    const input = String(fileName || '').replace(/^\/+/, '')
    const manifest = getManifest()
    const candidates = [input, `app/assets/${input}`, path.posix.basename(input)]

    const entry = candidates.map((key) => manifest[key]).find(Boolean)
    return entry?.file || input
  })
}
