# LOI Payment Service

Please refer to https://github.com/UKForeignOffice/loi-application-service for setup instructions

## About

This repo complements the LOI Application Service by adding the ability to take payments provided by GOV.UK PAY

## Frontend Assets: How Compilation Works

This service uses Vite to compile frontend JavaScript and SCSS into versioned (hashed) files for cache-safe delivery in production-like environments.

### Source files

- JavaScript entrypoint: `app/assets/scripts.js`
- Styles entrypoint: `app/assets/styles.js`
- Main SCSS importer: `app/assets/stylesheets/importer.scss`

`styles.js` imports `importer.scss`, which then imports GOV.UK Frontend and local SCSS files.

### Build output

Running `npm run build` produces a `dist/` folder containing:

- Compiled JS and CSS under `dist/assets/...`
- A `dist/manifest.json` file that maps source entry names to hashed output files

### How templates get the correct hashed files

At runtime, Nunjucks uses a `hashedAsset(...)` helper to look up asset filenames in `dist/manifest.json`.

- Templates request logical names (for example `style.css` and `scripts.js`)
- The helper resolves them to hashed files from the manifest
- Express serves `dist/` under `/api/payment/`

This means templates stay stable while users always receive the latest built assets.

### Local development workflow

1. Install dependencies: `npm install`
2. Build assets: `npm run build`
3. Start app: `npm start`

Or run the existing combined command:

- `npm run dev:local` (builds assets once, then starts the server)

Important: this repo currently does a one-time asset build. If you change frontend assets while the app is running, run `npm run build` again to refresh `dist/`.

### Adding or changing frontend assets (quick guide)

1. Update JS in `app/assets/scripts.js` (or import modules from there)
2. Update SCSS in files under `app/assets/stylesheets/`, and ensure they are imported from `importer.scss`
3. Rebuild with `npm run build`
4. Refresh the page and verify styles/scripts are loading

### Static asset paths

- App-built assets are served from `/api/payment/` (from `dist/`)
- Local images are served from `/api/payment/images`
- GOV.UK Frontend static assets are served from `/api/payment/assets/govuk-frontend/`

## Code Quality

This project uses **Biome** for formatting and linting.

**Available commands:**
- `npm run format` — Format and lint all files
- `npm run quality` — Check only changed files against the `develop` branch

**VSCode Setup:**

Install the [Biome extension](https://biomejs.dev/guides/editors/vscode/) (`biomejs.biome`), then add to `.vscode/settings.json`:

```jsonc
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

For other IDE see https://biomejs.dev/guides/getting-started/#editor-integrations
