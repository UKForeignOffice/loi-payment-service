import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      PORT: 6009,
    },
    exclude: [...configDefaults.exclude],
    coverage: {
      provider: 'v8',
      all: true,
      exclude: ['test/data/**/*.js'],
      thresholds: {
        lines: 35,
        functions: 30,
        branches: 26,
        statements: 35,
      },
    },
  },
})
