import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      PORT: 6009,
    },
    exclude: [...configDefaults.exclude],
    include: ['test/specs/vitest/**/*.spec.js'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['server/**/*.js', '!server/app.js', '!server/server.js'],
      thresholds: {
        lines: 35,
        functions: 30,
        branches: 27,
        statements: 35,
      },
    },
  },
})
