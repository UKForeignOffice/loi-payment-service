import * as path from 'node:path'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    cssMinify: 'esbuild',
    manifest: 'manifest.json',
    rollupOptions: {
      input: {
        styles: path.resolve(process.cwd(), 'app/assets/styles.js'),
        scripts: path.resolve(process.cwd(), 'app/assets/scripts.js'),
      },
      output: {
        // JS entry files
        entryFileNames: 'assets/scripts/[name]-[hash].js',
        // JS shared chunks (if any)
        chunkFileNames: 'assets/scripts/[name]-[hash].js',
        // CSS, images, fonts, media
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name ?? ''
          const ext = name.split('.').pop()?.toLowerCase() ?? ''

          if (ext === 'css') {
            return 'assets/stylesheets/[name]-[hash][extname]'
          }

          if (
            ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'ico', 'mp4', 'webm', 'ogg', 'mp3', 'wav'].includes(
              ext,
            )
          ) {
            return 'assets/images/[name]-[hash][extname]'
          }

          // optional: keep fonts with media/images bucket, or split to assets/fonts
          if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext)) {
            return 'assets/fonts/[name]-[hash][extname]'
          }

          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  test: {
    env: {
      NODE_ENV: 'test',
      PORT: 6009,
    },
    exclude: [...configDefaults.exclude],
    coverage: {
      provider: 'v8',
      exclude: ['test/data/**/*.js'],
      thresholds: {
        statements: 60,
        branches: 57,
        functions: 55,
        lines: 61,
      },
    },
  },

  resolve: {
    alias: {
      '@govuk': path.resolve(__dirname, 'node_modules/govuk-frontend/dist/govuk'),
    },
  },
})
